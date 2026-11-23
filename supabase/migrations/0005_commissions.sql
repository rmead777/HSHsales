-- ============================================================================
-- 0005 Commissions: rates, per-sale commission, refunds, payouts, rep balances.
--
-- Additive and safe on the live project: new columns are nullable or default
-- sensibly, one NOT NULL is relaxed (manual sales have no Stripe session), and
-- existing rows are recomputed at the end. Re-runnable.
--
-- How commission works:
--   rate     = the rep's own rate if an admin set one, else the product's rate.
--   captured = the rate is copied onto the sale when the sale is recorded, so
--              changing a rate later never rewrites past commissions. A sale
--              recorded before any rate existed picks one up as soon as one is set.
--   amount   = percent: rate% of what the customer paid, before tax, after refunds.
--              flat:    the fixed amount, scaled down by any refund.
--              Only paid sales earn. An admin can set any sale's commission by hand.
--   balance  = everything earned minus everything paid out (payouts table).
--              A refund after payout makes the balance go down, even below zero.
-- ============================================================================

-- ─────────────── products: price, commission rule, optional discount code ───────────────
alter table public.products
  add column if not exists price_cents integer
    check (price_cents is null or price_cents >= 0),
  add column if not exists commission_type text
    check (commission_type in ('percent', 'flat')),
  add column if not exists commission_value numeric(12, 2)
    check (commission_value is null or commission_value >= 0),
  add column if not exists promo_code text;

comment on column public.products.price_cents is 'What Stripe charges, in cents. Used only to show reps what they earn.';
comment on column public.products.commission_type is 'percent = commission_value% of the sale; flat = commission_value dollars per sale; null = not set.';
comment on column public.products.promo_code is 'Optional Stripe promotion code pre-filled on every rep link (prefilled_promo_code).';

-- ─────────────── profiles: optional per-rep rate (overrides the product rate) ───────────────
alter table public.profiles
  add column if not exists commission_type text
    check (commission_type in ('percent', 'flat')),
  add column if not exists commission_value numeric(12, 2)
    check (commission_value is null or commission_value >= 0);

-- ─────────────── sales: what the commission needs ───────────────
alter table public.sales alter column stripe_session_id drop not null;

alter table public.sales
  add column if not exists source text not null default 'stripe'
    check (source in ('stripe', 'manual')),
  add column if not exists product_id uuid references public.products (id) on delete set null,
  add column if not exists payment_intent text,
  add column if not exists payment_status text not null default 'paid'
    check (payment_status in ('paid', 'unpaid', 'failed', 'no_payment_required')),
  add column if not exists amount_tax integer not null default 0,
  add column if not exists amount_refunded integer not null default 0,
  add column if not exists customer_name text,
  add column if not exists promo_code text,
  add column if not exists note text,
  add column if not exists commission_type text
    check (commission_type in ('percent', 'flat')),
  add column if not exists commission_value numeric(12, 2),
  add column if not exists commission_override_cents integer,
  add column if not exists commission_cents integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists sales_payment_intent_idx on public.sales (payment_intent);
create index if not exists sales_product_id_idx on public.sales (product_id);

-- ─────────────── payouts: money paid to reps ───────────────
create table if not exists public.payouts (
  id           uuid primary key default gen_random_uuid(),
  rep_code     text not null,
  amount_cents integer not null check (amount_cents <> 0),
  paid_on      date not null default current_date,
  note         text,
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists payouts_rep_code_paid_on_idx on public.payouts (rep_code, paid_on desc);
alter table public.payouts enable row level security;

-- ─────────────── helper: the caller's own rep code (RLS-safe, like is_admin) ───────────────
create or replace function private.my_rep_code()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.rep_code from public.profiles p where p.id = (select auth.uid());
$$;

-- ─────────────── commission: computed on every sale write ───────────────
create or replace function public.sales_compute_commission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type  text;
  v_value numeric;
  v_gross integer;
  v_net   integer;
begin
  new.updated_at := now();

  -- Capture the rate on insert, when the rep or product changes, or while none is captured.
  if tg_op = 'INSERT'
     or new.rep_code is distinct from old.rep_code
     or new.product_id is distinct from old.product_id
     or new.commission_type is null then
    v_type := null;
    v_value := null;
    if new.rep_code is not null then
      select p.commission_type, p.commission_value into v_type, v_value
        from public.profiles p
       where p.rep_code = new.rep_code
         and p.commission_type is not null
         and p.commission_value is not null;
    end if;
    if v_type is null and new.product_id is not null then
      select pr.commission_type, pr.commission_value into v_type, v_value
        from public.products pr
       where pr.id = new.product_id
         and pr.commission_type is not null
         and pr.commission_value is not null;
    end if;
    new.commission_type := v_type;
    new.commission_value := v_value;
  end if;

  v_gross := greatest(coalesce(new.amount, 0) - coalesce(new.amount_tax, 0), 0);
  v_net := greatest(v_gross - coalesce(new.amount_refunded, 0), 0);

  if new.commission_override_cents is not null then
    new.commission_cents := new.commission_override_cents;
  elsif new.rep_code is null
     or new.commission_type is null
     or new.payment_status not in ('paid', 'no_payment_required') then
    new.commission_cents := 0;
  elsif new.commission_type = 'percent' then
    new.commission_cents := round(v_net * new.commission_value / 100.0);
  elsif v_gross = 0 then
    new.commission_cents := 0;
  else
    new.commission_cents := round(new.commission_value * 100 * v_net / v_gross::numeric);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sales_compute_commission on public.sales;
create trigger trg_sales_compute_commission
  before insert or update on public.sales
  for each row execute function public.sales_compute_commission();

-- When an admin first sets a rate, sales still waiting for one pick it up.
create or replace function public.refresh_unrated_sales()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.commission_type is not distinct from old.commission_type
     and new.commission_value is not distinct from old.commission_value then
    return new;
  end if;
  if tg_table_name = 'products' then
    update public.sales set updated_at = now()
     where product_id = new.id and commission_type is null;
  else
    update public.sales set updated_at = now()
     where rep_code = new.rep_code and commission_type is null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_products_refresh_unrated on public.products;
create trigger trg_products_refresh_unrated
  after update on public.products
  for each row execute function public.refresh_unrated_sales();

drop trigger if exists trg_profiles_refresh_unrated on public.profiles;
create trigger trg_profiles_refresh_unrated
  after update on public.profiles
  for each row execute function public.refresh_unrated_sales();

-- ─────────────── reps may not change their own code or rate ───────────────
create or replace function public.enforce_profile_protected_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Trusted backend (SQL editor as postgres, or the service-role key): allow.
  if (select auth.uid()) is null then
    return new;
  end if;
  -- Admins may change anything.
  if (select private.is_admin()) then
    return new;
  end if;
  -- A signed-in rep may not change their own access, code or commission rate.
  if new.active is distinct from old.active
     or new.role is distinct from old.role
     or new.rep_code is distinct from old.rep_code
     or new.commission_type is distinct from old.commission_type
     or new.commission_value is distinct from old.commission_value then
    raise exception 'not authorized to modify active, role, rep code or commission'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ─────────────── policies ───────────────
-- sales: admins add manual sales, edit any sale, delete only manual ones. Reps still only read their own.
drop policy if exists "sales_insert_admin" on public.sales;
create policy "sales_insert_admin" on public.sales
  for insert to authenticated
  with check ( (select private.is_admin()) and source = 'manual' );

drop policy if exists "sales_update_admin" on public.sales;
create policy "sales_update_admin" on public.sales
  for update to authenticated
  using ( (select private.is_admin()) )
  with check ( (select private.is_admin()) );

drop policy if exists "sales_delete_admin_manual" on public.sales;
create policy "sales_delete_admin_manual" on public.sales
  for delete to authenticated
  using ( (select private.is_admin()) and source = 'manual' );

-- payouts: admins do everything; a rep reads their own.
drop policy if exists "payouts_select_admin_or_own" on public.payouts;
create policy "payouts_select_admin_or_own" on public.payouts
  for select to authenticated
  using ( (select private.is_admin()) or rep_code = (select private.my_rep_code()) );

drop policy if exists "payouts_insert_admin" on public.payouts;
create policy "payouts_insert_admin" on public.payouts
  for insert to authenticated with check ( (select private.is_admin()) );

drop policy if exists "payouts_update_admin" on public.payouts;
create policy "payouts_update_admin" on public.payouts
  for update to authenticated
  using ( (select private.is_admin()) ) with check ( (select private.is_admin()) );

drop policy if exists "payouts_delete_admin" on public.payouts;
create policy "payouts_delete_admin" on public.payouts
  for delete to authenticated using ( (select private.is_admin()) );

grant select, insert, update, delete on public.sales   to authenticated;
grant select, insert, update, delete on public.payouts to authenticated;

-- ─────────────── rep balances (runs with the caller's RLS: reps see their own row) ───────────────
create or replace view public.rep_earnings
with (security_invoker = true) as
select
  p.id                                                         as rep_id,
  p.rep_code,
  p.full_name,
  p.email,
  p.role,
  p.active,
  coalesce(s.sales_count, 0)::int                              as sales_count,
  coalesce(s.revenue_cents, 0)::bigint                         as revenue_cents,
  coalesce(s.earned_cents, 0)::bigint                          as earned_cents,
  coalesce(s.waiting_count, 0)::int                            as waiting_count,
  coalesce(po.paid_cents, 0)::bigint                           as paid_cents,
  (coalesce(s.earned_cents, 0) - coalesce(po.paid_cents, 0))::bigint as balance_cents,
  s.last_sale_at
from public.profiles p
left join (
  select
    rep_code,
    count(*) filter (where payment_status in ('paid', 'no_payment_required'))            as sales_count,
    sum(greatest(coalesce(amount, 0) - amount_refunded, 0))
      filter (where payment_status in ('paid', 'no_payment_required'))                   as revenue_cents,
    sum(commission_cents)                                                                 as earned_cents,
    count(*) filter (where payment_status = 'unpaid')                                    as waiting_count,
    max(created_at)                                                                       as last_sale_at
  from public.sales
  where rep_code is not null
  group by rep_code
) s on s.rep_code = p.rep_code
left join (
  select rep_code, sum(amount_cents) as paid_cents
  from public.payouts
  group by rep_code
) po on po.rep_code = p.rep_code;

grant select on public.rep_earnings to authenticated;

-- ─────────────── live sale alerts in the app ───────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sales'
     ) then
    alter publication supabase_realtime add table public.sales;
  end if;
end $$;

-- Recompute any sales recorded before this migration.
update public.sales set updated_at = now();

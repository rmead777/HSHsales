-- ============================================================================
-- High Score Host — Sales App :: schema + RLS + triggers
-- Run this in the Supabase SQL editor for project cehlthclgguknjimimnw
-- (or via `supabase db push` if the CLI is linked to that project).
--
-- The activation GATE is enforced here, not in the app: gated tables are
-- SELECT-able only by profiles with active = true. An inactive rep gets zero rows.
-- ============================================================================

-- Private schema for SECURITY DEFINER helpers. Keep it OUT of API > Exposed schemas
-- (Dashboard → Project Settings → API) so these are never reachable as PostgREST RPCs.
create schema if not exists private;

-- ────────────────────────────── Tables ──────────────────────────────

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  full_name  text,
  role       text not null default 'rep' check (role in ('rep', 'admin')),
  active      boolean not null default false,
  rep_code   text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.links (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,
  url        text not null,
  sort_order integer not null default 0,
  active     boolean not null default true,
  icon       text
);

create table if not exists public.products (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  description         text,
  image_url           text,
  price_display       text,
  stripe_payment_link text not null,
  sort_order          integer not null default 0,
  active              boolean not null default true
);

create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  body       text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.sales (
  id                uuid primary key default gen_random_uuid(),
  stripe_session_id text not null unique,             -- idempotency key for the webhook
  rep_code          text,                             -- from Stripe client_reference_id
  product_name      text,
  amount            integer,                          -- minor units (cents)
  currency          text,
  customer_email    text,
  created_at        timestamptz not null default now()
);

create index if not exists sales_rep_code_idx on public.sales (rep_code);

-- Enable RLS on every table (tables created via SQL do NOT get it automatically).
alter table public.profiles      enable row level security;
alter table public.links         enable row level security;
alter table public.products      enable row level security;
alter table public.announcements enable row level security;
alter table public.sales         enable row level security;

-- ─────────────────── SECURITY DEFINER helpers (recursion fix) ───────────────────
-- These read the CALLING user's own row only (via auth.uid()). Being SECURITY DEFINER,
-- their internal read of public.profiles bypasses RLS — so policies on gated tables (and on
-- profiles itself) can call them without recursing. STABLE + initPlan-wrapped at call sites.

create or replace function private.is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.active = true
  );
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

-- ─────────────────── Signup trigger: create profile + unique rep_code ───────────────────
-- Server forces role='rep', active=false — never trust client metadata for those. The UNIQUE
-- constraint on rep_code is the real collision guard; the loop just retries on the rare clash.
-- gen_random_uuid()/md5() are in pg_catalog (always on search_path) so empty search_path is fine.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code     text;
  v_attempts int := 0;
begin
  loop
    v_attempts := v_attempts + 1;
    v_code := upper(substr(md5(gen_random_uuid()::text), 1, 8));
    begin
      insert into public.profiles (id, email, full_name, role, active, rep_code)
      values (new.id, new.email, new.raw_user_meta_data ->> 'full_name', 'rep', false, v_code);
      exit;
    exception when unique_violation then
      if v_attempts >= 8 then
        raise exception 'could not allocate a unique rep_code after % attempts', v_attempts;
      end if;
    end;
  end loop;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────── Anti-escalation: protect active/role on profiles ───────────────────
-- An RLS WITH CHECK sees only NEW (never OLD), so it cannot detect a changed role/active.
-- Enforce column immutability for non-admins with a BEFORE UPDATE trigger.

create or replace function public.enforce_profile_protected_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select private.is_admin()) then
    return new;                       -- admins may change anything
  end if;
  if new.active is distinct from old.active
     or new.role is distinct from old.role then
    raise exception 'not authorized to modify active or role'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_protect_cols on public.profiles;
create trigger trg_profiles_protect_cols
  before update on public.profiles
  for each row execute function public.enforce_profile_protected_columns();

-- ────────────────────────────── Policies ──────────────────────────────

-- profiles: read/update own row; admins read/update all. No INSERT (trigger only),
-- no DELETE (cascades from auth.users).
create policy "profiles_select_self_or_admin" on public.profiles
  for select to authenticated
  using ( id = (select auth.uid()) or (select private.is_admin()) );

create policy "profiles_update_self_or_admin" on public.profiles
  for update to authenticated
  using ( id = (select auth.uid()) or (select private.is_admin()) )
  with check ( id = (select auth.uid()) or (select private.is_admin()) );

-- Gated content (links / products / announcements): SELECT for any active profile;
-- INSERT/UPDATE/DELETE for admins only.
create policy "links_select_active" on public.links
  for select to authenticated using ( (select private.is_active()) );
create policy "links_insert_admin" on public.links
  for insert to authenticated with check ( (select private.is_admin()) );
create policy "links_update_admin" on public.links
  for update to authenticated using ( (select private.is_admin()) ) with check ( (select private.is_admin()) );
create policy "links_delete_admin" on public.links
  for delete to authenticated using ( (select private.is_admin()) );

create policy "products_select_active" on public.products
  for select to authenticated using ( (select private.is_active()) );
create policy "products_insert_admin" on public.products
  for insert to authenticated with check ( (select private.is_admin()) );
create policy "products_update_admin" on public.products
  for update to authenticated using ( (select private.is_admin()) ) with check ( (select private.is_admin()) );
create policy "products_delete_admin" on public.products
  for delete to authenticated using ( (select private.is_admin()) );

create policy "announcements_select_active" on public.announcements
  for select to authenticated using ( (select private.is_active()) );
create policy "announcements_insert_admin" on public.announcements
  for insert to authenticated with check ( (select private.is_admin()) );
create policy "announcements_update_admin" on public.announcements
  for update to authenticated using ( (select private.is_admin()) ) with check ( (select private.is_admin()) );
create policy "announcements_delete_admin" on public.announcements
  for delete to authenticated using ( (select private.is_admin()) );

-- sales: admins read all; a rep reads only their own rep_code's rows. No client writes —
-- the Stripe webhook inserts with the service-role key, which bypasses RLS entirely.
create policy "sales_select_admin" on public.sales
  for select to authenticated using ( (select private.is_admin()) );
create policy "sales_select_own_rep" on public.sales
  for select to authenticated
  using ( rep_code = (select p.rep_code from public.profiles p where p.id = (select auth.uid())) );

-- ────────────────────────────── Grants (Data API exposure) ──────────────────────────────
-- Tables created via SQL aren't auto-exposed to PostgREST; grant the table privilege and let
-- RLS gate the rows. We never grant gated content to anon.
grant select, update                 on public.profiles      to authenticated;
grant select, insert, update, delete on public.links         to authenticated;
grant select, insert, update, delete on public.products      to authenticated;
grant select, insert, update, delete on public.announcements to authenticated;
grant select                         on public.sales         to authenticated;

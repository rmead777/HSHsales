-- ============================================================================
-- Seed data — PLACEHOLDERS. Replace everything via the in-app Admin panel.
-- Idempotent: each block only inserts when its table is still empty.
-- ============================================================================

do $$
begin
  if not exists (select 1 from public.links) then
    insert into public.links (label, url, sort_order, active, icon) values
      ('Sales Deck', 'https://docs.google.com/presentation/d/REPLACE_ME', 1, true, 'deck'),
      ('Pricing',    'https://docs.google.com/spreadsheets/d/REPLACE_ME', 2, true, 'pricing'),
      ('Training',   'https://docs.google.com/document/d/REPLACE_ME',     3, true, 'training');
  end if;

  if not exists (select 1 from public.products) then
    insert into public.products (name, description, price_display, stripe_payment_link, sort_order, active) values
      ('1,000 Interactive Coasters',
       'PLACEHOLDER — replace via Admin. Lifetime license + swag.',
       '$1,000 (lifetime license + swag)',
       'https://buy.stripe.com/REPLACE_ME', 1, true),
      ('Subscription',
       'PLACEHOLDER — replace via Admin.',
       '$300',
       'https://buy.stripe.com/REPLACE_ME_2', 2, true);
  end if;

  if not exists (select 1 from public.announcements) then
    insert into public.announcements (body, active) values
      ('Welcome to High Score Host! This is a placeholder announcement — edit or remove it in Admin → News.', true);
  end if;
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- Make yourself an admin:
--   1. Sign up in the app with your email (you'll land on "Account pending").
--   2. Run this (replace the email), then reload the app:
--
--   update public.profiles set role = 'admin', active = true
--   where email = 'rmead777@gmail.com';
-- ────────────────────────────────────────────────────────────────────────────

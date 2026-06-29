-- Align indexes with the app's ordered read paths. These are safe to rerun.
create index if not exists links_active_sort_order_idx
  on public.links (active, sort_order);

create index if not exists products_active_sort_order_idx
  on public.products (active, sort_order);

create index if not exists announcements_active_created_at_idx
  on public.announcements (active, created_at desc);

create index if not exists sales_created_at_idx
  on public.sales (created_at desc);

create index if not exists sales_rep_code_created_at_idx
  on public.sales (rep_code, created_at desc);

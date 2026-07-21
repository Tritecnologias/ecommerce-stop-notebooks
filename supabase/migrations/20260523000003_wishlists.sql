-- BodySplashers — Wishlist
-- Migration: 20260523000003_wishlists

create table if not exists wishlists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles(id) on delete cascade not null,
  product_id uuid references products(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  constraint wishlists_user_product_unique unique (user_id, product_id)
);

alter table wishlists enable row level security;

create policy "wishlists_own" on wishlists
  using (auth.uid() = user_id);

grant all on wishlists to authenticated;
grant all on wishlists to service_role;

create index if not exists idx_wishlists_user_id    on wishlists(user_id);
create index if not exists idx_wishlists_product_id on wishlists(product_id);

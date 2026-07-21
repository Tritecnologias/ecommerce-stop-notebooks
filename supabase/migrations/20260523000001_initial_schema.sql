-- BodySplashers — Schema inicial
-- Migration: 20260523000001_initial_schema

-- =============================================
-- PROFILES (extensão de auth.users)
-- =============================================
create table if not exists profiles (
  id           uuid references auth.users on delete cascade primary key,
  name         text,
  phone        text,
  cpf          text,
  role         text not null default 'customer' check (role in ('customer', 'admin')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Trigger para criar profile automaticamente ao registrar
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, name)
  values (new.id, new.raw_user_meta_data->>'name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- =============================================
-- ADDRESSES
-- =============================================
create table if not exists addresses (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references profiles(id) on delete cascade not null,
  label          text not null default 'Principal',
  recipient      text not null,
  cep            text not null,
  street         text not null,
  number         text not null,
  complement     text,
  neighborhood   text not null,
  city           text not null,
  state          text not null,
  is_default     boolean not null default false,
  created_at     timestamptz not null default now()
);

-- =============================================
-- PRODUCTS
-- =============================================
create table if not exists products (
  id               uuid primary key default gen_random_uuid(),
  slug             text unique not null,
  name             text not null,
  short_description text,
  description      text,
  price            numeric(10,2) not null,
  old_price        numeric(10,2),
  category         text,
  tag              text check (tag in ('Mais Vendido', 'Lançamento', 'Frete Grátis')),
  notes            text[] not null default '{}',
  sizes            text[] not null default '{100ml,200ml}',
  images           text[] not null default '{}',
  rating           numeric(3,2) not null default 0,
  review_count     integer not null default 0,
  stock            integer not null default 0,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- =============================================
-- ORDERS
-- =============================================
create table if not exists orders (
  id                    uuid primary key default gen_random_uuid(),
  order_number          text unique not null,
  user_id               uuid references profiles(id) on delete set null,
  customer_name         text not null,
  customer_email        text not null,
  customer_phone        text,
  customer_cpf          text,
  shipping_cep          text,
  shipping_street       text,
  shipping_number       text,
  shipping_complement   text,
  shipping_neighborhood text,
  shipping_city         text,
  shipping_state        text,
  subtotal              numeric(10,2) not null,
  shipping_cost         numeric(10,2) not null default 0,
  total                 numeric(10,2) not null,
  payment_method        text not null check (payment_method in ('pix', 'credit_card', 'boleto')),
  payment_gateway       text check (payment_gateway in ('mercadopago', 'stripe', 'pagseguro')),
  payment_status        text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'refunded', 'cancelled')),
  payment_id            text,
  payment_url           text,
  payment_qr_code       text,
  payment_barcode       text,
  payment_expires_at    timestamptz,
  status                text not null default 'pending'
    check (status in ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
  tracking_code         text,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- =============================================
-- ORDER ITEMS
-- =============================================
create table if not exists order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid references orders(id) on delete cascade not null,
  product_id     uuid references products(id) on delete set null,
  product_name   text not null,
  product_slug   text not null,
  product_image  text,
  size           text not null,
  quantity       integer not null,
  unit_price     numeric(10,2) not null,
  total_price    numeric(10,2) not null
);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
alter table profiles enable row level security;
alter table addresses enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);
create policy "addresses_all_own" on addresses using (auth.uid() = user_id);
create policy "products_select_all" on products for select using (true);
create policy "products_write_admin" on products for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "orders_select_own" on orders for select
  using (auth.uid() = user_id or
         exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "orders_insert_any" on orders for insert with check (true);
create policy "orders_update_admin" on orders for update
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "order_items_select" on order_items for select
  using (exists (
    select 1 from orders o where o.id = order_id
    and (o.user_id = auth.uid() or
         exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  ));
create policy "order_items_insert" on order_items for insert with check (true);

-- =============================================
-- ÍNDICES
-- =============================================
create index if not exists idx_products_slug on products(slug);
create index if not exists idx_products_active on products(active);
create index if not exists idx_orders_user_id on orders(user_id);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_payment_status on orders(payment_status);
create index if not exists idx_orders_created_at on orders(created_at desc);
create index if not exists idx_order_items_order_id on order_items(order_id);

-- =============================================
-- GRANTS
-- =============================================
-- service_role: acesso total (bypassa RLS)
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

-- anon e authenticated: acesso via PostgREST + RLS
grant usage on schema public to anon, authenticated;

-- profiles: autenticado pode ver e editar o próprio (RLS garante isolamento)
grant select, update on profiles to authenticated;

-- addresses: autenticado tem acesso completo (RLS garante isolamento)
grant all on addresses to authenticated;

-- products: leitura pública; escrita só via service_role (admin)
grant select on products to anon, authenticated;

-- orders: criação aberta; leitura/edição via RLS
grant select, insert on orders to anon, authenticated;
grant update on orders to authenticated;

-- order_items: criação aberta; leitura via RLS
grant select, insert on order_items to anon, authenticated;

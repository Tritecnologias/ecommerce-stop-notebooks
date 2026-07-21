-- BodySplashers — Coupons
-- Migration: 20260523000002_coupons

-- =============================================
-- COUPONS
-- =============================================
create table if not exists coupons (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,
  type          text not null check (type in ('percent', 'fixed')),
  value         numeric(10,2) not null check (value > 0),
  min_order     numeric(10,2) not null default 0,
  max_uses      integer,                          -- null = ilimitado
  used_count    integer not null default 0,
  active        boolean not null default true,
  expires_at    timestamptz,
  created_at    timestamptz not null default now()
);

-- =============================================
-- ORDERS — adicionar colunas de cupom
-- =============================================
alter table orders
  add column if not exists coupon_code text,
  add column if not exists discount     numeric(10,2) not null default 0;

-- =============================================
-- RLS
-- =============================================
alter table coupons enable row level security;

create policy "coupons_select_all" on coupons
  for select using (true);

create policy "coupons_write_admin" on coupons
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- =============================================
-- GRANTS
-- =============================================
grant select on coupons to anon, authenticated;
grant all on coupons to service_role;

-- =============================================
-- ÍNDICES
-- =============================================
create index if not exists idx_coupons_code on coupons(upper(code));

-- =============================================
-- CUPONS DE EXEMPLO
-- =============================================
insert into coupons (code, type, value, min_order, max_uses, active)
values
  ('BEMVINDO10',   'percent', 10, 0,  null, true),
  ('BODYSPLASH20', 'fixed',   20, 80, 100,  true)
on conflict (code) do nothing;

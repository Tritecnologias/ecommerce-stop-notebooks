-- ============================================================================
-- SECRET DESIRE — Full Database Setup
-- Run this in psql: docker exec -i <container> psql -U postgres -d postgres < full-setup.sql
-- ============================================================================

-- ─── store_settings (key-value config) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS store_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── reviews ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id          UUID REFERENCES orders(id) ON DELETE SET NULL,
  customer_name     TEXT NOT NULL,
  customer_email    TEXT NOT NULL,
  rating            INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment           TEXT,
  verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,
  approved          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_select_approved" ON reviews FOR SELECT USING (approved = true OR auth.uid() = user_id);
CREATE POLICY "reviews_insert_auth" ON reviews FOR INSERT WITH CHECK (true);
GRANT SELECT, INSERT ON reviews TO authenticated;
GRANT ALL ON reviews TO service_role;

-- ─── stock_notifications ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_slug  TEXT NOT NULL,
  email         TEXT NOT NULL,
  notified_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_slug, email)
);

CREATE INDEX IF NOT EXISTS idx_stock_notif_slug ON stock_notifications(product_slug);
ALTER TABLE stock_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_notif_insert" ON stock_notifications FOR INSERT WITH CHECK (true);
GRANT INSERT ON stock_notifications TO anon, authenticated;
GRANT ALL ON stock_notifications TO service_role;

-- ─── banners ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS banners (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  subtitle      TEXT,
  badge         TEXT,
  bg_from       TEXT NOT NULL DEFAULT '#6366f1',
  bg_to         TEXT NOT NULL DEFAULT '#8b5cf6',
  button_label  TEXT,
  button_url    TEXT,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "banners_select_active" ON banners FOR SELECT USING (active = true);
CREATE POLICY "banners_admin" ON banners FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
GRANT SELECT ON banners TO anon, authenticated;
GRANT ALL ON banners TO service_role;

-- ─── Grants for store_settings ────────────────────────────────────────────────
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store_settings_select" ON store_settings FOR SELECT USING (true);
CREATE POLICY "store_settings_admin" ON store_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
GRANT SELECT ON store_settings TO anon, authenticated;
GRANT ALL ON store_settings TO service_role;

-- ─── Seed products ────────────────────────────────────────────────────────────
INSERT INTO products (slug, name, short_description, description, price, old_price, category, tag, notes, sizes, images, rating, review_count, stock, active)
VALUES
  ('vibrador-rabbit-deluxe', 'Vibrador Rabbit Deluxe', 'Estimulação dupla com 10 modos de vibração.', 'Vibrador rabbit em silicone médico hipoalergênico com motor duplo, 10 modos de vibração e carregamento USB.', 189.90, 249.90, 'Vibradores', 'Mais Vendido', ARRAY['Silicone médico','10 velocidades','Recarregável USB'], ARRAY['Padrão'], ARRAY['https://images.unsplash.com/photo-1616628188859-7a11abb6fcc9?auto=format&fit=crop&w=900&q=80'], 4.9, 312, 50, true),
  ('kit-massagem-sensual', 'Kit Massagem Sensual', 'Tudo para uma noite inesquecível a dois.', 'Kit com óleo de massagem aquecedor, vela aromática comestível e pluma estimulante.', 129.90, NULL, 'Cosméticos', 'Lançamento', ARRAY['Óleo aquecedor','Vela aromática','Pluma'], ARRAY['Kit completo'], ARRAY['https://images.unsplash.com/photo-1600428877878-1a0ff561571c?auto=format&fit=crop&w=900&q=80'], 4.8, 184, 38, true),
  ('lingerie-renda-luxo', 'Lingerie Renda Luxo', 'Conjunto em renda francesa com 3 peças.', 'Conjunto de lingerie em renda francesa importada: sutiã, calcinha e cinta-liga.', 149.90, 199.90, 'Lingeries', 'Frete Grátis', ARRAY['Renda francesa','Conjunto 3 peças','P ao GG'], ARRAY['P','M','G','GG'], ARRAY['https://images.unsplash.com/photo-1616628188859-7a11abb6fcc9?auto=format&fit=crop&w=900&q=80'], 4.7, 256, 45, true),
  ('gel-lubrificante-premium', 'Gel Lubrificante Premium', 'Lubrificante à base de água, longa duração.', 'Gel lubrificante íntimo à base de água, sem parabenos, dermatologicamente testado.', 59.90, NULL, 'Cosméticos', NULL, ARRAY['Base água','Longa duração','Sem parabenos'], ARRAY['100ml','200ml'], ARRAY['https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&w=900&q=80'], 4.6, 98, 22, true),
  ('kit-bdsm-iniciante', 'Kit BDSM Iniciante', 'Kit completo para explorar novas sensações.', 'Kit com 7 peças em couro sintético: algemas, venda, coleira, chicote, mordaça, corda e grampos.', 219.90, 289.90, 'Acessórios', 'Mais Vendido', ARRAY['7 peças','Couro sintético','Estojo incluso'], ARRAY['Kit 7 peças'], ARRAY['https://images.unsplash.com/photo-1557170334-a9086d51c3c1?auto=format&fit=crop&w=900&q=80'], 5.0, 421, 15, true),
  ('jogo-dados-picantes', 'Jogo dos Dados Picantes', 'Dados com posições e ações para apimentar.', 'Conjunto de 3 dados eróticos: um com partes do corpo, outro com ações e o terceiro com posições.', 49.90, NULL, 'Jogos Eróticos', 'Lançamento', ARRAY['3 dados','Posições','Ações'], ARRAY['Padrão'], ARRAY['https://images.unsplash.com/photo-1585386959984-a4155224a1ad?auto=format&fit=crop&w=900&q=80'], 4.7, 142, 33, true)
ON CONFLICT (slug) DO NOTHING;

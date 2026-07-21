-- ─── Programa de fidelidade ───────────────────────────────────────────────────
-- Cada pedido pago gera 1 ponto por R$1 gasto.
-- Pontos negativos = resgates futuros.

CREATE TABLE IF NOT EXISTS loyalty_points (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points     INTEGER     NOT NULL,                     -- positivo = ganho, negativo = resgate
  reason     TEXT        NOT NULL,                     -- ex.: "Compra #BS-xxx" ou "Resgate"
  order_id   UUID        REFERENCES orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_user ON loyalty_points(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_order ON loyalty_points(order_id);

ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;

-- Clientes veem apenas os próprios registros
CREATE POLICY "loyalty_select_own" ON loyalty_points
  FOR SELECT USING (auth.uid() = user_id);

-- Service role pode inserir (via webhook / server functions)
CREATE POLICY "loyalty_insert_service" ON loyalty_points
  FOR INSERT WITH CHECK (true);

-- ─── View de saldo ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW loyalty_balances AS
  SELECT
    user_id,
    COALESCE(SUM(points), 0) AS balance,
    COUNT(*) FILTER (WHERE points > 0) AS earned_count,
    COUNT(*) FILTER (WHERE points < 0) AS redeemed_count
  FROM loyalty_points
  GROUP BY user_id;

-- ─── Configuração padrão no store_settings ────────────────────────────────────
INSERT INTO store_settings (key, value) VALUES
  ('loyalty', '{"enabled": true, "pointsPerReal": 1, "minRedeemPoints": 100, "redeemRatio": 0.01}')
ON CONFLICT (key) DO NOTHING;

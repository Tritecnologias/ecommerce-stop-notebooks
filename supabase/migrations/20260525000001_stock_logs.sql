-- ──────────────────────────────────────────────────────────────────────────────
-- Log de movimentação de estoque
-- Registra toda alteração de qty: quem mudou, quando, de quanto para quanto.
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stock_logs (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid         NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_name  text         NOT NULL,          -- snapshot denormalizado
  admin_id      uuid         REFERENCES profiles(id) ON DELETE SET NULL,
  admin_name    text,                           -- snapshot (email ou nome)
  qty_before    integer      NOT NULL,
  qty_after     integer      NOT NULL,
  source        text         NOT NULL DEFAULT 'manual', -- manual | form | order | import
  note          text,
  created_at    timestamptz  NOT NULL DEFAULT now()
);

-- Índices para as queries mais comuns
CREATE INDEX IF NOT EXISTS stock_logs_product_created_idx
  ON stock_logs (product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS stock_logs_created_idx
  ON stock_logs (created_at DESC);

-- RLS
ALTER TABLE stock_logs ENABLE ROW LEVEL SECURITY;

-- Só admins lêem (service_role ignora RLS)
CREATE POLICY "stock_logs_admin_select" ON stock_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Inserções somente via service_role (server functions) — não via client direto
-- (nenhuma policy WITH CHECK para anon/authenticated = bloqueado)

GRANT ALL    ON stock_logs TO service_role;
GRANT SELECT ON stock_logs TO authenticated;

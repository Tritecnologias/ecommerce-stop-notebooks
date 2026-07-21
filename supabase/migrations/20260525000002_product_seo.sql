-- ──────────────────────────────────────────────────────────────────────────────
-- SEO por produto
-- meta_title, meta_description e og_image por produto.
-- Todos opcionais — o código faz fallback para name/short_description/images[0].
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS meta_title       text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS og_image         text;

COMMENT ON COLUMN products.meta_title       IS 'Meta title personalizado (padrão: "nome — BodySplashers")';
COMMENT ON COLUMN products.meta_description IS 'Meta description personalizada (padrão: short_description)';
COMMENT ON COLUMN products.og_image         IS 'Imagem Open Graph (padrão: images[0])';

-- ─── Configuração de Logotipos no store_settings ─────────────────────────────
-- Permite armazenar a lista de logotipos cadastrados e suas posições (cabeçalho, rodapé, favicon, admin).

INSERT INTO store_settings (key, value)
VALUES ('logos', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE store_settings IS 'Armazena configurações globais da loja, incluindo formas de pagamento, frete, whatsapp e logotipos';

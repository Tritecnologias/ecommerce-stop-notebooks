// ─────────────────────────────────────────────────────────────────────────────
// Importa produtos do CSV de exportação do Magento 1.x para o Supabase.
//
// Pré-requisito (só na primeira vez):
//   bun add --dev csv-parse
//
// Execução:
//   bun --env-file=.env run scripts/import-magento.mjs
// ─────────────────────────────────────────────────────────────────────────────

import { parse } from "csv-parse/sync";
import { readFileSync } from "node:fs";

// ── Configurações ────────────────────────────────────────────────────────────

const CSV_PATH = "C:/Users/Wanderson/Downloads/catalog_tendasex.csv";

// Base URL das imagens do Magento (sem barra no final).
// Exemplo: "https://www.tendasex.com.br/pub/media/catalog/product"
// Se vazio, o campo `images` ficará com os caminhos relativos do Magento.
const MAGENTO_IMAGE_BASE = "https://www.tendasex.com.br/media/catalog/product";

// Lote de inserção — quanto maior, mais rápido; se der timeout reduza.
const BATCH_SIZE = 100;

// ── Credenciais via .env ─────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌  Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env");
  process.exit(1);
}

// ── Leitura e parse do CSV ───────────────────────────────────────────────────
console.log("📂 Lendo CSV...");
const raw = readFileSync(CSV_PATH);
const rows = parse(raw, {
  columns: true,
  skip_empty_lines: false,  // preserva linhas vazias para o agrupamento
  relax_column_count: true, // Magento às vezes tem colunas extras
  trim: true,
  bom: true,                // ignora BOM UTF-8 se presente
});
console.log(`   ${rows.length.toLocaleString("pt-BR")} linhas lidas`);

// ── Agrupa linhas por SKU ────────────────────────────────────────────────────
// O Magento exporta 1 produto em várias linhas:
//   linha principal  → SKU preenchido + dados do produto
//   linhas seguintes → SKU vazio + _category / _product_websites / _media_image extras
const productMap = new Map();
let currentSku = null;

for (const row of rows) {
  const sku = row.sku?.trim();

  if (sku) {
    currentSku = sku;
    const categories = row._category?.trim() ? [row._category.trim()] : [];
    const images = row._media_image?.trim() ? [row._media_image.trim()] : [];
    productMap.set(sku, { ...row, _categories: categories, _images: images });
  } else if (currentSku && productMap.has(currentSku)) {
    const p = productMap.get(currentSku);
    if (row._category?.trim()) p._categories.push(row._category.trim());
    if (row._media_image?.trim()) {
      const img = row._media_image.trim();
      if (!p._images.includes(img)) p._images.push(img);
    }
  }
}
console.log(`   ${productMap.size.toLocaleString("pt-BR")} produtos agrupados`);

// ── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html) {
  if (!html) return null;
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || null;
}

// Retorna a parte mais específica da categoria mais profunda
function extractCategory(categories) {
  if (!categories.length) return null;
  const deepest = categories.reduce((a, b) =>
    b.split("/").length > a.split("/").length ? b : a, categories[0]);
  return deepest.split("/").pop()?.trim() || null;
}

// Gera slug a partir do url_key do Magento, ou do nome, ou do SKU
function toSlug(urlKey, name, sku) {
  const base =
    urlKey?.trim() ||
    name?.trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-") ||
    sku.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return base
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Transformação para o schema do Supabase ──────────────────────────────────
const products = [];
let skipped = 0;

for (const [sku, row] of productMap) {
  // Ignora produtos configuráveis / agrupados / virtuais (sem estoque próprio)
  const type = row._type?.toLowerCase().trim();
  if (type && type !== "simple") {
    skipped++;
    continue;
  }

  const price = parseFloat(row.price) || 0;
  if (price <= 0) { skipped++; continue; }  // sem preço = ignora

  const specialPrice = parseFloat(row.special_price) || 0;
  const finalPrice = specialPrice > 0 ? specialPrice : price;
  const oldPrice   = specialPrice > 0 ? price : null;

  const stock  = Math.max(0, Math.round(parseFloat(row.qty) || 0));
  const active = row.status === "1";

  const slug = toSlug(row.url_key, row.name, sku);
  if (!slug || !row.name?.trim()) { skipped++; continue; }

  const images = row._images
    .map(img => (MAGENTO_IMAGE_BASE ? `${MAGENTO_IMAGE_BASE}${img}` : img))
    .filter(Boolean);

  products.push({
    slug,
    name: row.name.trim(),
    short_description: stripHtml(row.short_description),
    description:       row.description?.trim() || null,
    price:             finalPrice,
    old_price:         oldPrice,
    category:          extractCategory(row._categories),
    tag:               null,
    notes:             [],
    sizes:             [],
    images,
    rating:            0,
    review_count:      0,
    stock,
    active,
    meta_title:        row.meta_title?.trim()       || null,
    meta_description:  row.meta_description?.trim() || null,
    og_image:          images[0]                    || null,
  });
}

console.log(
  `✅ ${products.length.toLocaleString("pt-BR")} produtos prontos` +
  ` (${skipped.toLocaleString("pt-BR")} ignorados — sem preço / tipo não-simples)`,
);

// ── Insere em lotes via Supabase REST API ────────────────────────────────────
let inserted = 0;
let errors   = 0;
const totalBatches = Math.ceil(products.length / BATCH_SIZE);

console.log(`\n🚀 Iniciando importação em ${totalBatches} lotes de ${BATCH_SIZE}...\n`);

for (let i = 0; i < products.length; i += BATCH_SIZE) {
  const batch    = products.slice(i, i + BATCH_SIZE);
  const batchNum = Math.floor(i / BATCH_SIZE) + 1;

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/products?on_conflict=slug`,
    {
      method: "POST",
      headers: {
        apikey:          SERVICE_ROLE_KEY,
        Authorization:   `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type":  "application/json",
        Prefer:          "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(batch),
    },
  );

  if (res.ok) {
    inserted += batch.length;
    process.stdout.write(`\r   Lote ${batchNum}/${totalBatches} ✓  —  ${inserted} produtos importados`);
  } else {
    const errText = await res.text();
    console.error(`\n❌ Lote ${batchNum} falhou (HTTP ${res.status}):`);
    console.error(errText.substring(0, 400));
    errors += batch.length;
  }
}

console.log(`\n\n🎉 Concluído: ${inserted} produtos importados, ${errors} com erro`);

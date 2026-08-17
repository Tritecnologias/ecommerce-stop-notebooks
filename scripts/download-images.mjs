// ─────────────────────────────────────────────────────────────────────────────
// Baixa todas as imagens de produtos do Magento para /data/product-images/
// e atualiza as URLs no banco para /images/filename.jpg
//
// Rodar na VPS:
// sudo docker run --rm --network tse2aod86v956klphhp1uj2m \
//   -v /tmp/import:/app -v /data/product-images:/data/product-images \
//   -e SUPABASE_URL=http://supabase-kong-tse2aod86v956klphhp1uj2m:8000 \
//   -e SUPABASE_SERVICE_ROLE_KEY=... \
//   node:22-alpine node /app/download-images.mjs
// ─────────────────────────────────────────────────────────────────────────────

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL || "http://supabase-kong-tse2aod86v956klphhp1uj2m:8000";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const headers = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
const IMAGE_DIR = "/data/product-images";
const CONCURRENCY = 10;

mkdirSync(IMAGE_DIR, { recursive: true });

// Busca todos os produtos com imagens externas (paginado)
async function fetchAll() {
  let all = [];
  let offset = 0;
  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/products?select=id,slug,images&images=neq.{}&order=slug&limit=1000&offset=${offset}`,
      { headers }
    );
    const data = await res.json();
    all = all.concat(data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return all;
}

// Gera nome único para o arquivo
function imageFileName(slug, index, url) {
  const ext = url.match(/\.(jpg|jpeg|png|webp|gif)/i)?.[0] || ".jpg";
  return `${slug}${index > 0 ? `-${index + 1}` : ""}${ext}`;
}

// Baixa uma imagem
async function downloadImage(url, destPath) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: "follow" });
    if (!res.ok) return false;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) return false;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 1000) return false; // imagem muito pequena = placeholder
    writeFileSync(destPath, buffer);
    return true;
  } catch {
    return false;
  }
}

console.log("Buscando produtos com imagens externas...");
const products = await fetchAll();
console.log(`${products.length} produtos com imagens`);

// Conta total de imagens
const totalImages = products.reduce((sum, p) => sum + (p.images?.length || 0), 0);
console.log(`${totalImages} imagens para baixar\n`);

let downloaded = 0;
let skipped = 0;
let failed = 0;

for (let i = 0; i < products.length; i += CONCURRENCY) {
  const batch = products.slice(i, i + CONCURRENCY);

  await Promise.all(batch.map(async (product) => {
    const newImages = [];

    for (let j = 0; j < product.images.length; j++) {
      const imgUrl = product.images[j];

      // Se já é uma URL local, não baixa
      if (imgUrl.startsWith("/images/")) {
        newImages.push(imgUrl);
        skipped++;
        continue;
      }

      const fileName = imageFileName(product.slug, j, imgUrl);
      const destPath = join(IMAGE_DIR, fileName);
      const localUrl = `/images/${fileName}`;

      // Se já foi baixada, não baixa de novo
      if (existsSync(destPath)) {
        newImages.push(localUrl);
        skipped++;
        continue;
      }

      const ok = await downloadImage(imgUrl, destPath);
      if (ok) {
        newImages.push(localUrl);
        downloaded++;
      } else {
        // Mantém a URL original se falhar
        newImages.push(imgUrl);
        failed++;
      }
    }

    // Atualiza no banco
    if (newImages.some(u => u.startsWith("/images/"))) {
      await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${product.id}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({ images: newImages, og_image: newImages[0] }),
      });
    }
  }));

  if ((i + CONCURRENCY) % 100 < CONCURRENCY) {
    process.stdout.write(`\r${i + CONCURRENCY}/${products.length} produtos | ${downloaded} baixadas | ${skipped} existentes | ${failed} falhas`);
  }
}

console.log(`\n\n🎉 Concluído!`);
console.log(`   ${downloaded} imagens baixadas`);
console.log(`   ${skipped} já existentes/locais`);
console.log(`   ${failed} falhas (manteve URL original)`);

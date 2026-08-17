const SUPABASE_URL = process.env.SUPABASE_URL || "http://supabase-kong-tse2aod86v956klphhp1uj2m:8000";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const headers = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
const MAGENTO_BASE = "https://www.tendasex.com.br";

async function fetchWithout() {
  let all = [];
  let offset = 0;
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?select=id,slug,name&images=eq.{}&order=name&limit=1000&offset=${offset}`, { headers });
    const data = await res.json();
    all = all.concat(data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return all;
}

function getBaseSlug(slug) {
  return slug.replace(/-[a-z]+$/, "").replace(/-[a-z]+-[a-z]+$/, "");
}

async function scrapeImage(slug) {
  const baseSlug = getBaseSlug(slug);
  const url = `${MAGENTO_BASE}/${baseSlug}.html`;
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/media\/catalog\/product\/cache\/1\/image\/1800x\/[^"'\s]+\.(jpg|jpeg|png|webp)/);
    if (match) return `${MAGENTO_BASE}/${match[0]}`;
    const fallback = html.match(/media\/catalog\/product\/cache\/[^"'\s]+\.(jpg|jpeg|png|webp)/);
    if (fallback) return `${MAGENTO_BASE}/${fallback[0]}`;
    return null;
  } catch {
    return null;
  }
}

console.log("Buscando produtos sem imagem...");
const products = await fetchWithout();
console.log(`${products.length} produtos sem imagem`);

let updated = 0;
let failed = 0;
const CONCURRENCY = 5;

for (let i = 0; i < products.length; i += CONCURRENCY) {
  const batch = products.slice(i, i + CONCURRENCY);
  const results = await Promise.all(batch.map(async (p) => {
    const imageUrl = await scrapeImage(p.slug);
    if (imageUrl) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${p.id}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({ images: [imageUrl], og_image: imageUrl }),
      });
      return res.ok ? "ok" : "fail";
    }
    return "no-image";
  }));

  results.forEach(r => { if (r === "ok") updated++; else if (r === "fail") failed++; });

  if ((i + CONCURRENCY) % 50 < CONCURRENCY) {
    process.stdout.write(`\r${i + CONCURRENCY}/${products.length} processados, ${updated} atualizados`);
  }
}

console.log(`\n\nConcluido: ${updated} atualizados, ${failed} falhas, ${products.length - updated - failed} sem imagem no Magento`);

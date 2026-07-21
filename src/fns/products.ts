import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase";
import type { DbProduct } from "@/lib/types";
import { notifyStockSubscribers } from "@/fns/stock-notifications";
import { sendLowStockAlert } from "@/fns/email";

// ─── Threshold helper ─────────────────────────────────────────────────────────
async function loadInventorySettings(db: ReturnType<typeof createSupabaseAdmin>) {
  try {
    const { data } = await db
      .from("store_settings")
      .select("value")
      .eq("key", "inventory")
      .single();
    const v = (data?.value ?? {}) as Record<string, unknown>;
    return {
      threshold: typeof v.lowStockThreshold === "number" ? v.lowStockThreshold : 5,
      adminEmail: typeof v.adminEmail === "string" ? v.adminEmail : "",
    };
  } catch {
    return { threshold: 5, adminEmail: "" };
  }
}

export const getProducts = createServerFn().handler(async (): Promise<DbProduct[]> => {
  const db = createSupabaseAdmin();
  const { data, error } = await db
    .from("products")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DbProduct[];
});

export const getProductBySlug = createServerFn()
  .inputValidator((slug: unknown) => z.string().parse(slug))
  .handler(async ({ data: slug }): Promise<DbProduct | null> => {
    const db = createSupabaseAdmin();
    const { data, error } = await db
      .from("products")
      .select("*")
      .eq("slug", slug)
      .eq("active", true)
      .single();
    if (error) return null;
    return data as DbProduct;
  });

export const getAdminProducts = createServerFn().handler(async (): Promise<DbProduct[]> => {
  const db = createSupabaseAdmin();
  const { data, error } = await db
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DbProduct[];
});

const ProductInput = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  short_description: z.string().optional(),
  description: z.string().optional(),
  price: z.number().positive(),
  old_price: z.number().positive().optional().nullable(),
  category: z.string().optional(),
  tag: z.enum(["Mais Vendido", "Lançamento", "Frete Grátis"]).optional().nullable(),
  notes: z.array(z.string()).default([]),
  sizes: z.array(z.string()).default([]),
  images: z.array(z.string()).default([]),
  stock: z.number().int().min(0).default(0),
  rating: z.number().min(0).max(5).default(0),
  review_count: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
  // Filtros sex shop
  for_whom: z.enum(["ela", "ele", "casal", "todos"]).optional().nullable(),
  experience_level: z.enum(["iniciante", "intermediario", "avancado"]).optional().nullable(),
  // SEO
  meta_title: z.string().optional().nullable(),
  meta_description: z.string().optional().nullable(),
  og_image: z.string().optional().nullable(),
});

export const createProduct = createServerFn()
  .inputValidator((input: unknown) => ProductInput.parse(input))
  .handler(async ({ data }): Promise<DbProduct> => {
    const db = createSupabaseAdmin();
    const { data: product, error } = await db
      .from("products")
      .insert({ ...data, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return product as DbProduct;
  });

export const updateProduct = createServerFn()
  .inputValidator((input: unknown) => z.object({ id: z.string(), data: ProductInput.partial() }).parse(input))
  .handler(async ({ data: { id, data } }): Promise<DbProduct> => {
    const db = createSupabaseAdmin();

    // Busca estado anterior (stock + slug + name)
    const { data: current } = await db
      .from("products")
      .select("stock, slug, name")
      .eq("id", id)
      .single();

    const { data: product, error } = await db
      .from("products")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Log de estoque quando o campo stock muda
    if (current && data.stock !== undefined && data.stock !== current.stock) {
      db.from("stock_logs").insert({
        product_id: id,
        product_name: current.name,
        admin_id: null,
        admin_name: null,
        qty_before: current.stock,
        qty_after: data.stock,
        source: "form",
      }).then(() => {}, console.error);
    }

    // Notifica inscritos se voltou ao estoque
    if (current && current.stock === 0 && data.stock && data.stock > 0 && current.slug) {
      notifyStockSubscribers(current.slug, product.name).catch(console.error);
    }

    return product as DbProduct;
  });

export const deleteProduct = createServerFn()
  .inputValidator((id: unknown) => z.string().parse(id))
  .handler(async ({ data: id }) => {
    const db = createSupabaseAdmin();
    const { error } = await db.from("products").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const getAdminProductById = createServerFn()
  .inputValidator((id: unknown) => z.string().parse(id))
  .handler(async ({ data: id }): Promise<DbProduct | null> => {
    const db = createSupabaseAdmin();
    const { data, error } = await db
      .from("products")
      .select("*")
      .eq("id", id)
      .single();
    if (error) return null;
    return data as DbProduct;
  });

export const adjustStock = createServerFn()
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string(),
      stock: z.number().int().min(0, "Estoque não pode ser negativo"),
      adminId: z.string().optional(),
      adminName: z.string().optional(),
      note: z.string().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const db = createSupabaseAdmin();

    // Busca estoque e slug atuais
    const { data: current } = await db
      .from("products")
      .select("stock, slug, name")
      .eq("id", data.id)
      .single();

    const { data: product, error } = await db
      .from("products")
      .update({ stock: data.stock, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .select("id, stock, slug, name")
      .single();
    if (error) throw new Error(error.message);

    // Grava log de movimentação (somente quando houve mudança real)
    if (current && current.stock !== data.stock) {
      db.from("stock_logs").insert({
        product_id: data.id,
        product_name: current.name,
        admin_id: data.adminId ?? null,
        admin_name: data.adminName ?? null,
        qty_before: current.stock,
        qty_after: data.stock,
        source: "manual",
        note: data.note ?? null,
      }).then(() => {}, console.error);
    }

    // Notifica inscritos se voltou ao estoque
    if (current && current.stock === 0 && data.stock > 0 && product?.slug) {
      notifyStockSubscribers(product.slug, product.name).catch(console.error);
    }

    // Alerta de estoque baixo para o admin
    if (
      current &&
      data.stock < current.stock && // estoque caiu
      product
    ) {
      const inv = await loadInventorySettings(db);
      if (inv.adminEmail && data.stock <= inv.threshold && data.stock > 0) {
        sendLowStockAlert(
          inv.adminEmail,
          product.name,
          product.slug ?? "",
          data.stock,
          inv.threshold,
        ).catch(console.error);
      }
    }

    return product;
  });

// ─── Log de estoque ───────────────────────────────────────────────────────────

export type StockLog = {
  id: string;
  product_id: string;
  product_name: string;
  admin_id: string | null;
  admin_name: string | null;
  qty_before: number;
  qty_after: number;
  source: string;
  note: string | null;
  created_at: string;
};

// ─── Busca full-text ─────────────────────────────────────────────────────────

export const searchProducts = createServerFn()
  .inputValidator((input: unknown) => z.string().min(2, "Mínimo 2 caracteres").parse(input))
  .handler(async ({ data: query }): Promise<DbProduct[]> => {
    const db = createSupabaseAdmin();
    const q = query.trim();
    const { data, error } = await db
      .from("products")
      .select("*")
      .eq("active", true)
      .or(
        `name.ilike.%${q}%,category.ilike.%${q}%,description.ilike.%${q}%,short_description.ilike.%${q}%`,
      )
      .order("name")
      .limit(40);
    if (error) throw new Error(error.message);
    return (data ?? []) as DbProduct[];
  });

// ─── Log de estoque ───────────────────────────────────────────────────────────

export const getStockLogs = createServerFn()
  .inputValidator((input: unknown) =>
    z.object({
      productId: z.string().optional(),
      limit: z.number().int().min(1).max(200).default(50),
    }).parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<StockLog[]> => {
    const db = createSupabaseAdmin();
    let query = db
      .from("stock_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.productId) query = query.eq("product_id", data.productId);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []) as StockLog[];
  });

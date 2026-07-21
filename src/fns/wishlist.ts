import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase";
import type { DbProduct } from "@/lib/types";

export type WishlistProduct = DbProduct & {
  wishlist_id: string;
  wishlisted_at: string;
};

// Retorna todos os produtos favoritados do usuário (com dados completos)
export const getUserWishlist = createServerFn()
  .inputValidator((id: unknown) => z.string().parse(id))
  .handler(async ({ data: userId }): Promise<WishlistProduct[]> => {
    const db = createSupabaseAdmin();
    const { data, error } = await db
      .from("wishlists")
      .select("id, created_at, products(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return (data ?? [])
      .filter((row) => row.products !== null)
      .map((row) => ({
        ...(row.products as unknown as DbProduct),
        wishlist_id: row.id,
        wishlisted_at: row.created_at,
      }));
  });

// Top produtos mais desejados — para painel admin
export type TopWishlistItem = {
  product_id: string;
  product_name: string;
  product_slug: string;
  product_image: string | null;
  wish_count: number;
};

export const getTopWishlisted = createServerFn()
  .handler(async (): Promise<TopWishlistItem[]> => {
    const db = createSupabaseAdmin();

    // Contagem por produto via group
    const { data, error } = await db
      .from("wishlists")
      .select("product_id, products(name, slug, images)")
      .order("product_id");

    if (error) throw new Error(error.message);

    // Agrupa client-side (Supabase não suporta GROUP BY via JS client sem rpc)
    const counts = new Map<string, { name: string; slug: string; image: string | null; count: number }>();
    for (const row of data ?? []) {
      const p = row.products as unknown as { name: string; slug: string; images: string[] } | null;
      if (!p) continue;
      const existing = counts.get(row.product_id);
      if (existing) {
        existing.count++;
      } else {
        counts.set(row.product_id, {
          name: p.name,
          slug: p.slug,
          image: p.images?.[0] ?? null,
          count: 1,
        });
      }
    }

    return [...counts.entries()]
      .map(([product_id, v]) => ({
        product_id,
        product_name: v.name,
        product_slug: v.slug,
        product_image: v.image,
        wish_count: v.count,
      }))
      .sort((a, b) => b.wish_count - a.wish_count)
      .slice(0, 10);
  });

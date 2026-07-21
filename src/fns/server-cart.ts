import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase";
import type { CartItem } from "@/lib/cart";

const CartItemSchema = z.object({ slug: z.string(), size: z.string(), quantity: z.number().int().positive() });

// ─── Carregar carrinho do servidor ────────────────────────────────────────────

export const loadServerCart = createServerFn()
  .inputValidator((input: unknown) => z.string().uuid().parse(input))
  .handler(async ({ data: userId }): Promise<CartItem[]> => {
    const db = createSupabaseAdmin();
    const { data } = await db
      .from("cart_items")
      .select("product_slug, size, quantity")
      .eq("user_id", userId);
    return (data ?? []).map((row) => ({
      slug: row.product_slug,
      size: row.size,
      quantity: row.quantity,
    }));
  });

// ─── Sincronizar carrinho completo para o servidor ────────────────────────────

export const syncServerCart = createServerFn()
  .inputValidator((input: unknown) =>
    z.object({
      userId: z.string().uuid(),
      items: z.array(CartItemSchema),
    }).parse(input),
  )
  .handler(async ({ data: { userId, items } }) => {
    const db = createSupabaseAdmin();

    if (items.length === 0) {
      // Limpa o carrinho no servidor
      await db.from("cart_items").delete().eq("user_id", userId);
      return { synced: 0 };
    }

    // Upsert: insere ou atualiza cada item
    const rows = items.map((item) => ({
      user_id: userId,
      product_slug: item.slug,
      size: item.size,
      quantity: item.quantity,
      updated_at: new Date().toISOString(),
    }));

    await db
      .from("cart_items")
      .upsert(rows, { onConflict: "user_id,product_slug,size" });

    // Remove itens que não estão mais no carrinho local
    const slugSizePairs = items.map((i) => `${i.slug}::${i.size}`);
    const { data: all } = await db
      .from("cart_items")
      .select("id, product_slug, size")
      .eq("user_id", userId);
    const toDelete = (all ?? [])
      .filter((row) => !slugSizePairs.includes(`${row.product_slug}::${row.size}`))
      .map((row) => row.id);
    if (toDelete.length > 0) {
      await db.from("cart_items").delete().in("id", toDelete);
    }

    return { synced: items.length };
  });

// ─── Limpar carrinho do servidor (após checkout) ─────────────────────────────

export const clearServerCart = createServerFn()
  .inputValidator((input: unknown) => z.string().uuid().parse(input))
  .handler(async ({ data: userId }) => {
    const db = createSupabaseAdmin();
    await db.from("cart_items").delete().eq("user_id", userId);
    return { cleared: true };
  });

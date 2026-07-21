import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase";
import type { Review } from "@/lib/types";

// ─── Pública: avaliações aprovadas de um produto ──────────────────────────────
export const getProductReviews = createServerFn()
  .inputValidator((slug: unknown) => z.string().parse(slug))
  .handler(async ({ data: slug }): Promise<Review[]> => {
    const db = createSupabaseAdmin();

    // Busca o product_id pelo slug
    const { data: product } = await db
      .from("products")
      .select("id")
      .eq("slug", slug)
      .single();

    if (!product) return [];

    const { data, error } = await db
      .from("reviews")
      .select("*")
      .eq("product_id", product.id)
      .eq("approved", true)
      .order("created_at", { ascending: false });

    if (error) return [];
    return (data ?? []) as Review[];
  });

// ─── Verifica se o usuário já avaliou este produto ────────────────────────────
export const getUserReview = createServerFn()
  .inputValidator((input: unknown) =>
    z.object({ productSlug: z.string(), userId: z.string() }).parse(input),
  )
  .handler(async ({ data: { productSlug, userId } }): Promise<Review | null> => {
    const db = createSupabaseAdmin();

    const { data: product } = await db
      .from("products")
      .select("id")
      .eq("slug", productSlug)
      .single();

    if (!product) return null;

    const { data } = await db
      .from("reviews")
      .select("*")
      .eq("product_id", product.id)
      .eq("user_id", userId)
      .single();

    return (data as Review) ?? null;
  });

// ─── Verifica se o usuário tem compra confirmada deste produto ────────────────
export const checkVerifiedPurchase = createServerFn()
  .inputValidator((input: unknown) =>
    z.object({ productSlug: z.string(), userId: z.string() }).parse(input),
  )
  .handler(async ({ data: { productSlug, userId } }): Promise<boolean> => {
    const db = createSupabaseAdmin();
    const { data } = await db
      .from("order_items")
      .select("id, orders!inner(user_id, status)")
      .eq("product_slug", productSlug)
      .eq("orders.user_id", userId)
      .in("orders.status", ["delivered", "shipped"]);

    return (data?.length ?? 0) > 0;
  });

// ─── Criar avaliação ──────────────────────────────────────────────────────────
const CreateReviewSchema = z.object({
  productSlug: z.string(),
  userId: z.string().optional(),
  customerName: z.string().min(2, "Nome obrigatório"),
  customerEmail: z.string().email("E-mail inválido"),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export const createReview = createServerFn()
  .inputValidator((input: unknown) => CreateReviewSchema.parse(input))
  .handler(async ({ data }): Promise<Review> => {
    const db = createSupabaseAdmin();

    // Busca product_id
    const { data: product, error: productError } = await db
      .from("products")
      .select("id")
      .eq("slug", data.productSlug)
      .single();

    if (productError || !product) throw new Error("Produto não encontrado");

    // Verifica se já avaliou (se usuário logado)
    if (data.userId) {
      const { data: existing } = await db
        .from("reviews")
        .select("id")
        .eq("product_id", product.id)
        .eq("user_id", data.userId)
        .single();

      if (existing) throw new Error("Você já avaliou este produto.");
    }

    // Verifica compra confirmada
    let verifiedPurchase = false;
    if (data.userId) {
      const { data: purchaseData } = await db
        .from("order_items")
        .select("id, orders!inner(user_id, status)")
        .eq("product_slug", data.productSlug)
        .eq("orders.user_id", data.userId)
        .in("orders.status", ["delivered", "shipped"]);
      verifiedPurchase = (purchaseData?.length ?? 0) > 0;
    }

    const { data: review, error } = await db
      .from("reviews")
      .insert({
        product_id: product.id,
        user_id: data.userId ?? null,
        customer_name: data.customerName,
        customer_email: data.customerEmail,
        rating: data.rating,
        comment: data.comment ?? null,
        verified_purchase: verifiedPurchase,
        approved: true, // auto-aprovado; admin pode reprovar depois
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return review as Review;
  });

// ─── Admin: todas as avaliações ───────────────────────────────────────────────
export const getAdminReviews = createServerFn()
  .handler(async (): Promise<Review[]> => {
    const db = createSupabaseAdmin();
    const { data, error } = await db
      .from("reviews")
      .select("*, products(name, slug)")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return (data ?? []).map((r) => ({
      ...r,
      product_name: (r.products as { name: string } | null)?.name ?? "",
      product_slug: (r.products as { slug: string } | null)?.slug ?? "",
    })) as Review[];
  });

// ─── Admin: aprovar / reprovar ────────────────────────────────────────────────
export const updateReviewApproval = createServerFn()
  .inputValidator((input: unknown) =>
    z.object({ reviewId: z.string(), approved: z.boolean() }).parse(input),
  )
  .handler(async ({ data }) => {
    const db = createSupabaseAdmin();
    const { error } = await db
      .from("reviews")
      .update({ approved: data.approved, updated_at: new Date().toISOString() })
      .eq("id", data.reviewId);
    if (error) throw new Error(error.message);
  });

// ─── Admin: deletar ───────────────────────────────────────────────────────────
export const deleteReview = createServerFn()
  .inputValidator((id: unknown) => z.string().parse(id))
  .handler(async ({ data: id }) => {
    const db = createSupabaseAdmin();
    const { error } = await db.from("reviews").delete().eq("id", id);
    if (error) throw new Error(error.message);
  });

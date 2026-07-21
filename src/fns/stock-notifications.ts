import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase";
import { sendBackInStockEmail } from "@/fns/email";

// ─── Inscrição do cliente ─────────────────────────────────────────────────────
export const subscribeStockNotification = createServerFn()
  .inputValidator((input: unknown) =>
    z.object({
      productSlug: z.string(),
      email: z.string().email("Email inválido"),
    }).parse(input),
  )
  .handler(async ({ data }): Promise<{ success: true; alreadySubscribed?: boolean }> => {
    const db = createSupabaseAdmin();

    const { data: product } = await db
      .from("products")
      .select("id, name, stock")
      .eq("slug", data.productSlug)
      .single();

    if (!product) throw new Error("Produto não encontrado");
    if ((product.stock ?? 0) > 0) throw new Error("Produto já está disponível no estoque");

    // Se já está inscrito e aguardando, apenas retorna
    const { data: existing } = await db
      .from("stock_notifications")
      .select("id, notified_at")
      .eq("product_slug", data.productSlug)
      .eq("email", data.email)
      .maybeSingle();

    if (existing && !existing.notified_at) {
      return { success: true, alreadySubscribed: true };
    }

    // Upsert: insere ou reativa quem já foi notificado e voltou a ver esgotado
    const { error } = await db.from("stock_notifications").upsert(
      {
        product_id: product.id,
        product_slug: data.productSlug,
        email: data.email,
        notified_at: null,
      },
      { onConflict: "product_slug,email" },
    );

    if (error) throw new Error(error.message);
    return { success: true };
  });

// ─── Disparo interno — chamado de products.ts quando estoque é reposto ────────
export async function notifyStockSubscribers(
  productSlug: string,
  productName: string,
): Promise<void> {
  try {
    const db = createSupabaseAdmin();

    const { data: subscribers } = await db
      .from("stock_notifications")
      .select("id, email")
      .eq("product_slug", productSlug)
      .is("notified_at", null);

    if (!subscribers || subscribers.length === 0) return;

    const now = new Date().toISOString();
    const ids = subscribers.map((s) => s.id);

    // Marca como notificado antes de enviar (evita duplicatas em atualizações concorrentes)
    await db.from("stock_notifications").update({ notified_at: now }).in("id", ids);

    // Envia os emails (fire-and-forget por assinante)
    for (const sub of subscribers) {
      sendBackInStockEmail(sub.email, productName, productSlug).catch((e) =>
        console.error("[back-in-stock] Falha ao enviar para", sub.email, e),
      );
    }

    console.log(`[stock-notify] ${subscribers.length} assinante(s) notificado(s) para "${productName}"`);
  } catch (e) {
    console.error("[stock-notify] Erro:", e);
  }
}

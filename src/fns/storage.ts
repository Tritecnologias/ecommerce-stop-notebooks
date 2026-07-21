import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase";

const BUCKET = "product-images";

// ─── Gera URL assinada para upload direto do browser ─────────────────────────
// O browser faz PUT na signedUrl com o arquivo; o service role key nunca
// é exposto — apenas a URL temporária (TTL curto do Supabase).
export const getProductImageUploadUrl = createServerFn()
  .inputValidator((input: unknown) =>
    z.object({
      fileName: z.string().min(1),
      contentType: z.string().regex(/^image\//, "Apenas imagens são permitidas"),
    }).parse(input),
  )
  .handler(async ({ data }): Promise<{ uploadUrl: string; publicUrl: string }> => {
    const db = createSupabaseAdmin();

    const rawExt = data.fileName.split(".").pop()?.toLowerCase() ?? "jpg";
    const safeExt = ["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(rawExt)
      ? rawExt
      : "jpg";
    const path = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`;

    const { data: signed, error } = await db.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);

    if (error || !signed) {
      const msg = error?.message ?? "Bucket não encontrado";
      throw new Error(
        msg.includes("not found")
          ? `Bucket "${BUCKET}" não existe. Crie-o no Supabase Storage (público).`
          : `Falha ao gerar URL de upload: ${msg}`,
      );
    }

    const { data: { publicUrl } } = db.storage.from(BUCKET).getPublicUrl(path);

    return { uploadUrl: signed.signedUrl, publicUrl };
  });

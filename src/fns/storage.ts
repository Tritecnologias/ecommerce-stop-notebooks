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

    // Converte para rota relativa pelo proxy local /supabase/...
    // Isso garante que tanto o PUT de upload quanto a exibição da imagem ocorram
    // pela mesma origem da página (HTTPS), evitando bloqueios de Mixed Content.
    const toProxyUrl = (fullUrl: string) => {
      try {
        const u = new URL(fullUrl);
        return `/supabase${u.pathname}${u.search}`;
      } catch {
        return fullUrl;
      }
    };

    return {
      uploadUrl: toProxyUrl(signed.signedUrl),
      publicUrl: toProxyUrl(publicUrl),
    };
  });

// ─── Gera URL assinada para upload de Logotipo ──────────────────────────────
export const getLogoUploadUrl = createServerFn()
  .inputValidator((input: unknown) =>
    z.object({
      fileName: z.string().min(1),
      contentType: z.string().regex(/^image\//, "Apenas imagens são permitidas"),
    }).parse(input),
  )
  .handler(async ({ data }): Promise<{ uploadUrl: string; publicUrl: string }> => {
    const db = createSupabaseAdmin();

    const rawExt = data.fileName.split(".").pop()?.toLowerCase() ?? "png";
    const safeExt = ["jpg", "jpeg", "png", "webp", "gif", "avif", "svg", "ico"].includes(rawExt)
      ? rawExt
      : "png";
    const path = `logos/${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`;

    const { data: signed, error } = await db.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);

    if (error || !signed) {
      const msg = error?.message ?? "Bucket não encontrado";
      throw new Error(
        msg.includes("not found")
          ? `Bucket "${BUCKET}" não existe. Crie-o no Supabase Storage (público).`
          : `Falha ao gerar URL de upload para logotipo: ${msg}`,
      );
    }

    const { data: { publicUrl } } = db.storage.from(BUCKET).getPublicUrl(path);

    const toProxyUrl = (fullUrl: string) => {
      try {
        const u = new URL(fullUrl);
        return `/supabase${u.pathname}${u.search}`;
      } catch {
        return fullUrl;
      }
    };

    return {
      uploadUrl: toProxyUrl(signed.signedUrl),
      publicUrl: toProxyUrl(publicUrl),
    };
  });

// ─── Exclui arquivo do storage quando logotipo for removido ─────────────────
export const deleteStorageFile = createServerFn()
  .inputValidator((input: unknown) =>
    z.object({
      fileUrl: z.string().min(1),
    }).parse(input),
  )
  .handler(async ({ data: { fileUrl } }) => {
    try {
      const db = createSupabaseAdmin();
      let path = fileUrl;
      if (path.includes(BUCKET)) {
        path = path.split(`${BUCKET}/`)[1] || path;
      }
      // Remove possíveis parâmetros de busca
      path = path.split("?")[0];
      if (path) {
        await db.storage.from(BUCKET).remove([path]);
      }
      return { success: true };
    } catch {
      // Ignora erro se arquivo já não existir
      return { success: false };
    }
  });


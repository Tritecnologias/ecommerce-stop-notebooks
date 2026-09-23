import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase";
import { deleteStorageFile } from "./storage";

export type LogoPlacement = "header" | "footer" | "favicon" | "admin" | "all";

export type StoreLogo = {
  id: string;
  name: string;
  url: string;
  placement: LogoPlacement;
  active: boolean;
  height: number;
  alt_text?: string;
  created_at: string;
  updated_at: string;
};

export type ActiveLogos = {
  header: StoreLogo | null;
  footer: StoreLogo | null;
  favicon: StoreLogo | null;
  admin: StoreLogo | null;
};

const LogoWriteSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  url: z.string().min(1, "URL da imagem é obrigatória"),
  placement: z.enum(["header", "footer", "favicon", "admin", "all"]),
  active: z.boolean().default(true),
  height: z.number().int().min(16).max(250).default(40),
  alt_text: z.string().optional().default(""),
});

const SETTINGS_KEY = "logos";

async function fetchLogosFromDb(): Promise<StoreLogo[]> {
  try {
    const db = createSupabaseAdmin();
    const { data, error } = await db
      .from("store_settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .single();

    if (error || !data || !Array.isArray(data.value)) {
      return [];
    }

    return data.value as StoreLogo[];
  } catch {
    return [];
  }
}

async function saveLogosToDb(logos: StoreLogo[]): Promise<void> {
  const db = createSupabaseAdmin();
  const { error } = await db.from("store_settings").upsert(
    {
      key: SETTINGS_KEY,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      value: logos as any,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) {
    throw new Error(`Falha ao salvar logotipos: ${error.message}`);
  }
}

// ─── Busca todos os logotipos cadastrados (Admin) ─────────────────────────────
export const getLogos = createServerFn().handler(async (): Promise<StoreLogo[]> => {
  return await fetchLogosFromDb();
});

// ─── Busca logotipos ativos por aplicação (Header, Footer, Favicon, Admin) ────
export const getActiveLogos = createServerFn().handler(async (): Promise<ActiveLogos> => {
  const logos = await fetchLogosFromDb();
  const activeLogos = logos.filter((l) => l.active);

  const headerLogo =
    activeLogos.find((l) => l.placement === "header") ||
    activeLogos.find((l) => l.placement === "all") ||
    null;

  const footerLogo =
    activeLogos.find((l) => l.placement === "footer") ||
    activeLogos.find((l) => l.placement === "all") ||
    null;

  const faviconLogo = activeLogos.find((l) => l.placement === "favicon") || null;

  const adminLogo =
    activeLogos.find((l) => l.placement === "admin") ||
    headerLogo ||
    null;

  return {
    header: headerLogo,
    footer: footerLogo,
    favicon: faviconLogo,
    admin: adminLogo,
  };
});

// ─── Cadastra novo logotipo ──────────────────────────────────────────────────
export const createLogo = createServerFn()
  .inputValidator((input: unknown) => LogoWriteSchema.parse(input))
  .handler(async ({ data }): Promise<StoreLogo> => {
    const list = await fetchLogosFromDb();
    const now = new Date().toISOString();

    const newLogo: StoreLogo = {
      id: crypto.randomUUID(),
      name: data.name.trim(),
      url: data.url,
      placement: data.placement,
      active: data.active,
      height: data.height || 40,
      alt_text: data.alt_text?.trim() || "",
      created_at: now,
      updated_at: now,
    };

    // Se marcado como ativo, desativa outros com a mesma posição para evitar conflitos
    let updatedList = list;
    if (newLogo.active) {
      updatedList = list.map((item) => {
        if (newLogo.placement === "all") {
          return { ...item, active: false };
        }
        if (item.placement === newLogo.placement || item.placement === "all") {
          return { ...item, active: false };
        }
        return item;
      });
    }

    updatedList.unshift(newLogo);
    await saveLogosToDb(updatedList);

    return newLogo;
  });

// ─── Atualiza logotipo existente ─────────────────────────────────────────────
export const updateLogo = createServerFn()
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        data: LogoWriteSchema.partial(),
      })
      .parse(input),
  )
  .handler(async ({ data: { id, data } }): Promise<StoreLogo> => {
    const list = await fetchLogosFromDb();
    const target = list.find((l) => l.id === id);

    if (!target) {
      throw new Error("Logotipo não encontrado");
    }

    const updatedPlacement = data.placement ?? target.placement;
    const updatedActive = data.active ?? target.active;

    const updatedList = list.map((item) => {
      if (item.id === id) {
        return {
          ...item,
          ...data,
          name: data.name?.trim() ?? item.name,
          alt_text: data.alt_text !== undefined ? data.alt_text.trim() : item.alt_text,
          updated_at: new Date().toISOString(),
        };
      }

      // Se este logo foi ativado, desativa outros conflitantes
      if (updatedActive && (item.placement === updatedPlacement || updatedPlacement === "all" || item.placement === "all")) {
        return { ...item, active: false };
      }

      return item;
    });

    await saveLogosToDb(updatedList);

    const updated = updatedList.find((l) => l.id === id)!;
    return updated;
  });

// ─── Alterna status ativo com 1 clique ─────────────────────────────────────────
export const toggleLogoActive = createServerFn()
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        active: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data: { id, active } }) => {
    const list = await fetchLogosFromDb();
    const target = list.find((l) => l.id === id);

    if (!target) {
      throw new Error("Logotipo não encontrado");
    }

    const updatedList = list.map((item) => {
      if (item.id === id) {
        return { ...item, active, updated_at: new Date().toISOString() };
      }
      if (active && (item.placement === target.placement || target.placement === "all" || item.placement === "all")) {
        return { ...item, active: false };
      }
      return item;
    });

    await saveLogosToDb(updatedList);
    return { success: true };
  });

// ─── Remove logotipo e exclui arquivo associado no storage ───────────────────
export const deleteLogo = createServerFn()
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data: { id } }) => {
    const list = await fetchLogosFromDb();
    const target = list.find((l) => l.id === id);

    if (!target) {
      return { success: true };
    }

    const updatedList = list.filter((l) => l.id !== id);
    await saveLogosToDb(updatedList);

    // Tenta remover o arquivo do storage em background
    if (target.url) {
      try {
        await deleteStorageFile({ data: { fileUrl: target.url } });
      } catch {
        // Ignora erro se não conseguir apagar o arquivo físico
      }
    }

    return { success: true };
  });

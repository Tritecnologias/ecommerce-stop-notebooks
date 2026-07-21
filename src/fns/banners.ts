import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase";

export type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  badge: string | null;
  bg_from: string;
  bg_to: string;
  button_label: string | null;
  button_url: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const BannerWriteSchema = z.object({
  title: z.string().min(1, "Obrigatório"),
  subtitle: z.string().nullable().optional(),
  badge: z.string().nullable().optional(),
  bg_from: z.string().default("#0a0a0a"),
  bg_to: z.string().default("#111111"),
  button_label: z.string().nullable().optional(),
  button_url: z.string().nullable().optional(),
  active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});

export const getActiveBanners = createServerFn()
  .handler(async (): Promise<Banner[]> => {
    const db = createSupabaseAdmin();
    const { data, error } = await db
      .from("banners")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (error) return [];
    return (data ?? []) as Banner[];
  });

export const getAdminBanners = createServerFn()
  .handler(async (): Promise<Banner[]> => {
    const db = createSupabaseAdmin();
    const { data, error } = await db
      .from("banners")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Banner[];
  });

export const createBanner = createServerFn()
  .inputValidator((input: unknown) => BannerWriteSchema.parse(input))
  .handler(async ({ data }) => {
    const db = createSupabaseAdmin();
    const { error } = await db.from("banners").insert({ ...data, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
  });

export const updateBanner = createServerFn()
  .inputValidator((input: unknown) =>
    z.object({ id: z.string(), data: BannerWriteSchema.partial() }).parse(input),
  )
  .handler(async ({ data: { id, data } }) => {
    const db = createSupabaseAdmin();
    const { error } = await db
      .from("banners")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
  });

export const deleteBanner = createServerFn()
  .inputValidator((input: unknown) => z.string().parse(input))
  .handler(async ({ data: id }) => {
    const db = createSupabaseAdmin();
    const { error } = await db.from("banners").delete().eq("id", id);
    if (error) throw new Error(error.message);
  });

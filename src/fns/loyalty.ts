import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type LoyaltyConfig = {
  enabled: boolean;
  pointsPerReal: number;   // pontos por R$1 gasto
  minRedeemPoints: number; // mínimo para resgatar
  redeemRatio: number;     // 0.01 = 1 ponto = R$0,01
};

export const DEFAULT_LOYALTY_CONFIG: LoyaltyConfig = {
  enabled: true,
  pointsPerReal: 1,
  minRedeemPoints: 100,
  redeemRatio: 0.01,
};

export type LoyaltyEntry = {
  id: string;
  points: number;
  reason: string;
  order_id: string | null;
  created_at: string;
};

export type LoyaltySummary = {
  balance: number;
  history: LoyaltyEntry[];
  config: LoyaltyConfig;
};

// ─── Configuração ─────────────────────────────────────────────────────────────

async function loadLoyaltyConfig(
  db: ReturnType<typeof createSupabaseAdmin>,
): Promise<LoyaltyConfig> {
  const { data } = await db
    .from("store_settings")
    .select("value")
    .eq("key", "loyalty")
    .single();
  return data ? { ...DEFAULT_LOYALTY_CONFIG, ...(data.value as Partial<LoyaltyConfig>) } : DEFAULT_LOYALTY_CONFIG;
}

export const getLoyaltyConfig = createServerFn().handler(
  async (): Promise<LoyaltyConfig> => {
    const db = createSupabaseAdmin();
    return loadLoyaltyConfig(db);
  },
);

export const updateLoyaltyConfig = createServerFn()
  .inputValidator((input: unknown) =>
    z.object({
      enabled: z.boolean(),
      pointsPerReal: z.number().int().min(1).max(100),
      minRedeemPoints: z.number().int().min(1),
      redeemRatio: z.number().min(0.001).max(1),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const db = createSupabaseAdmin();
    await db.from("store_settings").upsert(
      { key: "loyalty", value: data as unknown as import("@/lib/database.types").Json, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
    return data;
  });

// ─── Saldo + histórico do cliente ─────────────────────────────────────────────

export const getLoyaltySummary = createServerFn()
  .inputValidator((input: unknown) => z.string().uuid().parse(input))
  .handler(async ({ data: userId }): Promise<LoyaltySummary> => {
    const db = createSupabaseAdmin();
    const [config, { data: entries }] = await Promise.all([
      loadLoyaltyConfig(db),
      db
        .from("loyalty_points")
        .select("id, points, reason, order_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const history = (entries ?? []) as LoyaltyEntry[];
    const balance = history.reduce((s, e) => s + e.points, 0);

    return { balance, history, config };
  });

// ─── Premiação interna (chamada pelos webhooks) ───────────────────────────────

export async function awardLoyaltyPoints(
  userId: string,
  orderId: string,
  orderTotal: number,
): Promise<void> {
  try {
    const db = createSupabaseAdmin();
    const config = await loadLoyaltyConfig(db);
    if (!config.enabled) return;

    const points = Math.floor(orderTotal * config.pointsPerReal);
    if (points <= 0) return;

    // Evita duplicatas: não premiamos o mesmo pedido duas vezes
    const { data: existing } = await db
      .from("loyalty_points")
      .select("id")
      .eq("order_id", orderId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) return;

    await db.from("loyalty_points").insert({
      user_id: userId,
      points,
      reason: `Compra confirmada`,
      order_id: orderId,
    });

    console.log(`[loyalty] +${points} pontos para ${userId} (pedido ${orderId})`);
  } catch (e) {
    console.error("[loyalty] Erro ao premiar pontos:", e);
  }
}

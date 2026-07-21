import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase";
import { SHIPPING_RATES, DEFAULT_FREE_FROM, type ShippingConfig } from "@/lib/shipping";

export type PaymentMethod = "pix" | "credit_card" | "boleto";

export type StoreSettings = {
  payment_methods: PaymentMethod[];
};

const DEFAULT_SETTINGS: StoreSettings = {
  payment_methods: ["pix", "credit_card", "boleto"],
};

export const getStoreSettings = createServerFn()
  .handler(async (): Promise<StoreSettings> => {
    const db = createSupabaseAdmin();
    const { data } = await db
      .from("store_settings")
      .select("key, value")
      .eq("key", "payment_methods")
      .single();

    if (!data) return DEFAULT_SETTINGS;

    return {
      payment_methods: data.value as PaymentMethod[],
    };
  });

export const updateStoreSettings = createServerFn()
  .inputValidator((input: unknown) =>
    z.object({
      payment_methods: z
        .array(z.enum(["pix", "credit_card", "boleto"]))
        .min(1, "Pelo menos uma forma de pagamento deve estar ativa"),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const db = createSupabaseAdmin();
    const { error } = await db
      .from("store_settings")
      .upsert(
        { key: "payment_methods", value: data.payment_methods, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    if (error) throw new Error(error.message);
  });

export { type ShippingConfig };

const DEFAULT_SHIPPING_CONFIG: ShippingConfig = {
  freeFrom: DEFAULT_FREE_FROM,
  rates: Object.fromEntries(
    Object.entries(SHIPPING_RATES).map(([state, r]) => [state, { price: r.price, days: r.days }]),
  ),
};

export const getShippingConfig = createServerFn()
  .handler(async (): Promise<ShippingConfig> => {
    const db = createSupabaseAdmin();
    const { data } = await db
      .from("store_settings")
      .select("value")
      .eq("key", "shipping")
      .single();
    if (!data) return DEFAULT_SHIPPING_CONFIG;
    const saved = data.value as Partial<ShippingConfig>;
    return {
      freeFrom: saved.freeFrom ?? DEFAULT_FREE_FROM,
      rates: {
        ...DEFAULT_SHIPPING_CONFIG.rates,
        ...(saved.rates ?? {}),
      },
    };
  });

const StateRateSchema = z.object({ price: z.number().positive(), days: z.number().int().positive() });

export const updateShippingConfig = createServerFn()
  .inputValidator((input: unknown) =>
    z.object({
      freeFrom: z.number().min(0),
      rates: z.record(StateRateSchema),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const db = createSupabaseAdmin();
    const { error } = await db
      .from("store_settings")
      .upsert(
        { key: "shipping", value: data, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    if (error) throw new Error(error.message);
  });

// ─── Modo de Teste ────────────────────────────────────────────────────────────

export type TestModeConfig = {
  pix_enabled: boolean;
};

const DEFAULT_TEST_MODE: TestModeConfig = { pix_enabled: false };

export const getTestMode = createServerFn()
  .handler(async (): Promise<TestModeConfig> => {
    try {
      const db = createSupabaseAdmin();
      const { data, error } = await db
        .from("store_settings")
        .select("value")
        .eq("key", "test_mode")
        .single();
      if (error || !data) return DEFAULT_TEST_MODE;
      return data.value as TestModeConfig;
    } catch {
      return DEFAULT_TEST_MODE;
    }
  });

export const updateTestMode = createServerFn()
  .inputValidator((input: unknown) =>
    z.object({ pix_enabled: z.boolean() }).parse(input),
  )
  .handler(async ({ data }) => {
    const db = createSupabaseAdmin();
    const { error } = await db
      .from("store_settings")
      .upsert(
        { key: "test_mode", value: data, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    if (error) throw new Error(error.message);
  });

// ─── Estoque / inventário ─────────────────────────────────────────────────────

export type InventorySettings = {
  lowStockThreshold: number;  // alerta quando stock <= este valor
  adminEmail: string;         // e-mail que recebe o alerta
};

const DEFAULT_INVENTORY: InventorySettings = {
  lowStockThreshold: 5,
  adminEmail: "",
};

export const getInventorySettings = createServerFn().handler(
  async (): Promise<InventorySettings> => {
    const db = createSupabaseAdmin();
    const { data } = await db
      .from("store_settings")
      .select("value")
      .eq("key", "inventory")
      .single();
    if (!data) return DEFAULT_INVENTORY;
    return { ...DEFAULT_INVENTORY, ...(data.value as Partial<InventorySettings>) };
  },
);

export const updateInventorySettings = createServerFn()
  .inputValidator((input: unknown) =>
    z.object({
      lowStockThreshold: z.number().int().min(0).max(999),
      adminEmail: z.string().email("Email inválido").or(z.literal("")),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const db = createSupabaseAdmin();
    await db
      .from("store_settings")
      .upsert(
        {
          key: "inventory",
          value: data as unknown as import("../lib/database.types").Json,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );
    return data;
  });

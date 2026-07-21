import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase";

export type CouponResult = {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  discount: number; // valor real deduzido (já calculado sobre o total)
};

export type AdminCoupon = {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  min_order: number;
  max_uses: number | null;
  used_count: number;
  active: boolean;
  expires_at: string | null;
  created_at: string;
};

const CouponWriteSchema = z.object({
  code: z.string().min(1),
  type: z.enum(["percent", "fixed"]),
  value: z.number().positive(),
  min_order: z.number().min(0).default(0),
  max_uses: z.number().int().positive().nullable().optional(),
  expires_at: z.string().nullable().optional(),
  active: z.boolean().default(true),
});

export const validateCoupon = createServerFn()
  .inputValidator((input: unknown) =>
    z.object({
      code: z.string().min(1),
      orderTotal: z.number().positive(),
    }).parse(input),
  )
  .handler(async ({ data: { code, orderTotal } }): Promise<CouponResult> => {
    const db = createSupabaseAdmin();

    const { data: coupon, error } = await db
      .from("coupons")
      .select("*")
      .eq("code", code.toUpperCase().trim())
      .eq("active", true)
      .single();

    if (error || !coupon) throw new Error("Cupom inválido ou não encontrado.");

    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      throw new Error("Este cupom já expirou.");
    }

    if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
      throw new Error("Este cupom já atingiu o limite de usos.");
    }

    if (orderTotal < coupon.min_order) {
      const minFmt = coupon.min_order.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      throw new Error(`Pedido mínimo para este cupom: ${minFmt}`);
    }

    const rawDiscount =
      coupon.type === "percent"
        ? (orderTotal * Number(coupon.value)) / 100
        : Math.min(Number(coupon.value), orderTotal);

    const discount = Math.round(rawDiscount * 100) / 100;

    return {
      id: coupon.id as string,
      code: coupon.code as string,
      type: coupon.type as "percent" | "fixed",
      value: Number(coupon.value),
      discount,
    };
  });

export const getAdminCoupons = createServerFn()
  .handler(async (): Promise<AdminCoupon[]> => {
    const db = createSupabaseAdmin();
    const { data, error } = await db
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data as AdminCoupon[];
  });

export const createCoupon = createServerFn()
  .inputValidator((input: unknown) => CouponWriteSchema.parse(input))
  .handler(async ({ data }) => {
    const db = createSupabaseAdmin();
    const { error } = await db.from("coupons").insert({
      ...data,
      code: data.code.toUpperCase().trim(),
    });
    if (error) throw new Error(error.message);
  });

export const updateCoupon = createServerFn()
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string(),
      data: CouponWriteSchema.partial(),
    }).parse(input),
  )
  .handler(async ({ data: { id, data } }) => {
    const db = createSupabaseAdmin();
    const patch = data.code ? { ...data, code: data.code.toUpperCase().trim() } : data;
    const { error } = await db.from("coupons").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
  });

export const deleteCoupon = createServerFn()
  .inputValidator((input: unknown) => z.string().parse(input))
  .handler(async ({ data: id }) => {
    const db = createSupabaseAdmin();
    const { error } = await db.from("coupons").delete().eq("id", id);
    if (error) throw new Error(error.message);
  });

export type CouponStats = {
  totalActive: number;
  totalUses: number;
  totalDiscountGranted: number;
  ordersWithCoupon: number;
  totalOrders: number;
  topCoupon: { code: string; uses: number } | null;
};

export const getAdminCouponStats = createServerFn()
  .handler(async (): Promise<CouponStats> => {
    const db = createSupabaseAdmin();
    const [couponsRes, ordersRes] = await Promise.all([
      db.from("coupons").select("code, active, used_count"),
      db.from("orders").select("coupon_code, discount").not("coupon_code", "is", null),
    ]);

    const coupons = couponsRes.data ?? [];
    const orders = ordersRes.data ?? [];

    const totalActive = coupons.filter((c) => c.active).length;
    const totalUses = coupons.reduce((s, c) => s + (c.used_count ?? 0), 0);
    const totalDiscountGranted = orders.reduce((s, o) => s + (o.discount ?? 0), 0);

    const usageMap = new Map<string, number>();
    for (const o of orders) {
      if (o.coupon_code) usageMap.set(o.coupon_code, (usageMap.get(o.coupon_code) ?? 0) + 1);
    }
    const topEntry = [...usageMap.entries()].sort((a, b) => b[1] - a[1])[0];

    const { count: totalOrders } = await db.from("orders").select("id", { count: "exact", head: true });

    return {
      totalActive,
      totalUses,
      totalDiscountGranted,
      ordersWithCoupon: orders.length,
      totalOrders: totalOrders ?? 0,
      topCoupon: topEntry ? { code: topEntry[0], uses: topEntry[1] } : null,
    };
  });

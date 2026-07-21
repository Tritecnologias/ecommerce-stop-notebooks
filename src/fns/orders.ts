import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase";
import type { Order, CreateOrderInput } from "@/lib/types";
import { STORE } from "@/lib/store";
import { calcShippingCost, DEFAULT_FREE_FROM, SHIPPING_RATES, type ShippingConfig } from "@/lib/shipping";
import { sendOrderConfirmation, sendStatusUpdate } from "@/fns/email";

function generateOrderNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BS-${ts}-${rand}`;
}

const OrderInputSchema = z.object({
  user_id: z.string().optional(),
  customer_name: z.string().min(2),
  customer_email: z.string().email(),
  customer_phone: z.string().min(10),
  customer_cpf: z.string().min(11),
  shipping_cep: z.string().min(8),
  shipping_street: z.string().min(1),
  shipping_number: z.string().min(1),
  shipping_complement: z.string().optional(),
  shipping_neighborhood: z.string().min(1),
  shipping_city: z.string().min(1),
  shipping_state: z.string().min(2),
  payment_method: z.enum(["pix", "credit_card", "boleto"]),
  coupon_code: z.string().optional(),
  items: z.array(
    z.object({
      product_id: z.string().optional(),
      product_name: z.string(),
      product_slug: z.string(),
      product_image: z.string().optional(),
      size: z.string(),
      quantity: z.number().int().positive(),
      unit_price: z.number().positive(),
    }),
  ).min(1),
});

export const createOrder = createServerFn()
  .inputValidator((input: unknown) => OrderInputSchema.parse(input as CreateOrderInput))
  .handler(async ({ data }): Promise<Order> => {
    const db = createSupabaseAdmin();

    const subtotal = data.items.reduce((s, i) => s + i.unit_price * i.quantity, 0);

    // Load shipping config from DB (falls back to defaults if not configured)
    let shippingConfig: ShippingConfig | undefined;
    try {
      const { data: cfgRow } = await db.from("store_settings").select("value").eq("key", "shipping").single();
      if (cfgRow) {
        const saved = cfgRow.value as Partial<ShippingConfig>;
        shippingConfig = {
          freeFrom: saved.freeFrom ?? DEFAULT_FREE_FROM,
          rates: { ...Object.fromEntries(Object.entries(SHIPPING_RATES).map(([s, r]) => [s, { price: r.price, days: r.days }])), ...(saved.rates ?? {}) },
        };
      }
    } catch { /* use defaults */ }

    const freeFrom = shippingConfig?.freeFrom ?? STORE.shipping.freeFrom;
    const shipping_cost = calcShippingCost(data.shipping_state, subtotal, freeFrom, shippingConfig);

    // Resolve IDs reais pelo slug — não confia no product_id do client (pode ser mock "p1","p2"...)
    const slugs = [...new Set(data.items.map((i) => i.product_slug))];
    const { data: dbProducts } = await db.from("products").select("id, slug").in("slug", slugs);
    const slugToId = Object.fromEntries((dbProducts ?? []).map((p) => [p.slug, p.id as string]));

    // ── Validar cupom server-side (nunca confiar no client) ──────────────────
    let discount = 0;
    let resolvedCouponCode: string | null = null;

    if (data.coupon_code) {
      const code = data.coupon_code.toUpperCase().trim();
      const { data: coupon, error: couponError } = await db
        .from("coupons")
        .select("*")
        .eq("code", code)
        .eq("active", true)
        .single();

      if (!couponError && coupon) {
        const notExpired = !coupon.expires_at || new Date(coupon.expires_at) >= new Date();
        const hasUses = coupon.max_uses === null || coupon.used_count < coupon.max_uses;
        const meetsMin = subtotal >= Number(coupon.min_order);

        if (notExpired && hasUses && meetsMin) {
          const raw =
            coupon.type === "percent"
              ? (subtotal * Number(coupon.value)) / 100
              : Math.min(Number(coupon.value), subtotal);
          discount = Math.round(raw * 100) / 100;
          resolvedCouponCode = code;
        }
      }
    }

    const total = Math.max(0, subtotal + shipping_cost - discount);

    const { data: order, error: orderError } = await db
      .from("orders")
      .insert({
        order_number: generateOrderNumber(),
        user_id: data.user_id ?? null,
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        customer_phone: data.customer_phone,
        customer_cpf: data.customer_cpf,
        shipping_cep: data.shipping_cep,
        shipping_street: data.shipping_street,
        shipping_number: data.shipping_number,
        shipping_complement: data.shipping_complement ?? null,
        shipping_neighborhood: data.shipping_neighborhood,
        shipping_city: data.shipping_city,
        shipping_state: data.shipping_state,
        payment_method: data.payment_method,
        coupon_code: resolvedCouponCode,
        discount,
        subtotal,
        shipping_cost,
        total,
        status: "pending",
        payment_status: "pending",
      })
      .select()
      .single();

    if (orderError) throw new Error(orderError.message);

    // Incrementa used_count do cupom após pedido criado com sucesso
    if (resolvedCouponCode) {
      try {
        const { data: couponRow } = await db
          .from("coupons")
          .select("used_count")
          .eq("code", resolvedCouponCode)
          .single();
        if (couponRow) {
          await db
            .from("coupons")
            .update({ used_count: (couponRow as { used_count: number }).used_count + 1 })
            .eq("code", resolvedCouponCode);
        }
      } catch {
        // Não crítico — pedido já foi criado
      }
    }

    const { error: itemsError } = await db.from("order_items").insert(
      data.items.map((item) => ({
        order_id: order.id,
        product_id: slugToId[item.product_slug] ?? null,
        product_name: item.product_name,
        product_slug: item.product_slug,
        product_image: item.product_image ?? null,
        size: item.size,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.unit_price * item.quantity,
      })),
    );

    if (itemsError) throw new Error(itemsError.message);

    // E-mail de confirmação — fire-and-forget, não bloqueia a resposta
    const fullOrder = { ...order, order_items: data.items.map((item, idx) => ({
      id: `tmp-${idx}`,
      order_id: order.id,
      product_id: slugToId[item.product_slug] ?? null,
      product_name: item.product_name,
      product_slug: item.product_slug,
      product_image: item.product_image ?? null,
      size: item.size,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.unit_price * item.quantity,
    })) } as Order;
    sendOrderConfirmation(fullOrder).catch((e) => console.error("[email] confirmação:", e));

    return order as Order;
  });

export const getOrderById = createServerFn()
  .inputValidator((id: unknown) => z.string().parse(id))
  .handler(async ({ data: id }): Promise<Order | null> => {
    const db = createSupabaseAdmin();
    const { data, error } = await db
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", id)
      .single();
    if (error) return null;
    return data as Order;
  });

export const getUserOrders = createServerFn()
  .inputValidator((userId: unknown) => z.string().parse(userId))
  .handler(async ({ data: userId }): Promise<Order[]> => {
    const db = createSupabaseAdmin();
    const { data, error } = await db
      .from("orders")
      .select("*, order_items(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Order[];
  });

export const getAdminOrders = createServerFn()
  .inputValidator((input: unknown) =>
    z.object({
      status: z.string().optional(),
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(20),
    }).parse(input ?? {}),
  )
  .handler(async ({ data: { status, page, limit } }) => {
    const db = createSupabaseAdmin();
    let query = db
      .from("orders")
      .select("*, order_items(*)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (status && status !== "all") query = query.eq("status", status);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    return { orders: (data ?? []) as Order[], total: count ?? 0, page, limit };
  });

export type CustomerSummary = {
  user_id: string | null;
  customer_name: string;
  customer_email: string;
  order_count: number;
  total_spent: number;
  last_order_at: string;
};

export const getAdminCustomers = createServerFn()
  .handler(async (): Promise<CustomerSummary[]> => {
    const db = createSupabaseAdmin();
    const { data, error } = await db
      .from("orders")
      .select("user_id, customer_name, customer_email, total, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const map = new Map<string, CustomerSummary>();
    for (const row of data ?? []) {
      const key = row.customer_email;
      if (map.has(key)) {
        const c = map.get(key)!;
        c.order_count += 1;
        c.total_spent += row.total;
        if (row.created_at > c.last_order_at) c.last_order_at = row.created_at;
      } else {
        map.set(key, {
          user_id: row.user_id,
          customer_name: row.customer_name,
          customer_email: row.customer_email,
          order_count: 1,
          total_spent: row.total,
          last_order_at: row.created_at,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.total_spent - a.total_spent);
  });

// ─── Modo de Teste: confirma pagamento imediatamente ─────────────────────────
export const markOrderPaid = createServerFn()
  .inputValidator((id: unknown) => z.string().parse(id))
  .handler(async ({ data: id }): Promise<Order> => {
    const db = createSupabaseAdmin();
    const { data: updated, error } = await db
      .from("orders")
      .update({
        payment_status: "paid",
        status: "confirmed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*, order_items(*)")
      .single();
    if (error) throw new Error(error.message);
    // E-mail de status "confirmado" — fire-and-forget
    if (updated) {
      sendStatusUpdate(updated as Order).catch((e) => console.error("[email] test markOrderPaid:", e));
    }
    return updated as Order;
  });

export const updateOrderStatus = createServerFn()
  .inputValidator((input: unknown) =>
    z.object({
      orderId: z.string(),
      status: z.enum(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]),
      trackingCode: z.string().optional(),
      notes: z.string().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const db = createSupabaseAdmin();
    const { data: updated, error } = await db
      .from("orders")
      .update({
        status: data.status,
        tracking_code: data.trackingCode ?? undefined,
        notes: data.notes ?? undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.orderId)
      .select("*, order_items(*)")
      .single();
    if (error) throw new Error(error.message);

    // E-mail de atualização de status — fire-and-forget
    if (updated) {
      sendStatusUpdate(updated as Order).catch((e) => console.error("[email] status update:", e));
    }

    return { success: true };
  });

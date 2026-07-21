import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase";
import { processPayment } from "@/lib/payment";
import type { Order, OrderItem, PaymentResult } from "@/lib/types";

export const initiatePayment = createServerFn()
  .inputValidator((orderId: unknown) => z.string().parse(orderId))
  .handler(async ({ data: orderId }): Promise<PaymentResult> => {
    const db = createSupabaseAdmin();

    const { data: order, error } = await db
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", orderId)
      .single();

    if (error || !order) throw new Error("Pedido não encontrado");

    const items = (order.order_items ?? []) as OrderItem[];
    const appUrl = process.env.APP_URL || "http://localhost:3000";

    const result = await processPayment(order as Order, items, appUrl);

    await db
      .from("orders")
      .update({
        payment_gateway: result.gateway,
        payment_id: result.paymentId ?? null,
        payment_url: result.redirectUrl ?? null,
        payment_qr_code: result.qrCode ?? null,
        payment_barcode: result.barcode ?? null,
        payment_expires_at: result.expiresAt ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    return result;
  });

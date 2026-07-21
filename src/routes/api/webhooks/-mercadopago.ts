import { createAPIFileRoute } from "@tanstack/react-start/api";
import { createSupabaseAdmin } from "@/lib/supabase";
import { notifyAdminNewOrder, notifyCustomerOrderConfirmed } from "@/fns/whatsapp";
import { awardLoyaltyPoints } from "@/fns/loyalty";

export const APIRoute = createAPIFileRoute("/api/webhooks/mercadopago")({
  POST: async ({ request }) => {
    const db = createSupabaseAdmin();
    const body = await request.json() as { type: string; data: { id: string } };

    if (body.type !== "payment") {
      return new Response("ignored", { status: 200 });
    }

    const paymentId = body.data?.id;
    if (!paymentId) return new Response("bad request", { status: 400 });

    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!token) return new Response("no token", { status: 500 });

    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payment = await res.json() as { status: string; status_detail: string; id: number };

    const statusMap: Record<string, "paid" | "failed" | "pending" | "refunded"> = {
      approved: "paid",
      rejected: "failed",
      cancelled: "failed",
      refunded: "refunded",
      pending: "pending",
      in_process: "pending",
      authorized: "pending",
    };
    const paymentStatus = statusMap[payment.status] ?? "pending";

    const { data: updatedOrder } = await db
      .from("orders")
      .update({
        payment_status: paymentStatus,
        status: paymentStatus === "paid" ? "confirmed" : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("payment_id", String(payment.id))
      .select("id")
      .single();

    // Notificações WhatsApp + pontos de fidelidade quando pagamento confirmado
    if (paymentStatus === "paid" && updatedOrder?.id) {
      const orderId = updatedOrder.id;
      notifyAdminNewOrder(orderId).catch(console.error);
      notifyCustomerOrderConfirmed(orderId).catch(console.error);

      // Pontos de fidelidade (apenas para clientes autenticados)
      const { data: order } = await db
        .from("orders")
        .select("user_id, total")
        .eq("id", orderId)
        .single();
      if (order?.user_id) {
        awardLoyaltyPoints(order.user_id, orderId, order.total).catch(console.error);
      }
    }

    return new Response("ok", { status: 200 });
  },
});

import { createAPIFileRoute } from "@tanstack/react-start/api";
import Stripe from "stripe";
import { createSupabaseAdmin } from "@/lib/supabase";
import { notifyAdminNewOrder, notifyCustomerOrderConfirmed } from "@/fns/whatsapp";

export const APIRoute = createAPIFileRoute("/api/webhooks/stripe")({
  POST: async ({ request }) => {
    const db = createSupabaseAdmin();
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secretKey || !webhookSecret) {
      return new Response("missing config", { status: 500 });
    }

    const stripe = new Stripe(secretKey, {
      apiVersion: "2025-06-30.basil",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const sig = request.headers.get("stripe-signature") ?? "";
    const body = await request.text();

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
    } catch {
      return new Response("invalid signature", { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.order_id;
      if (orderId) {
        await db
          .from("orders")
          .update({
            payment_status: "paid",
            payment_id: session.payment_intent as string,
            status: "confirmed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId);
        // Notificações WhatsApp
        notifyAdminNewOrder(orderId).catch(console.error);
        notifyCustomerOrderConfirmed(orderId).catch(console.error);
      }
    }

    if (event.type === "payment_intent.payment_failed") {
      const pi = event.data.object as Stripe.PaymentIntent;
      const orderId = pi.metadata?.order_id;
      if (orderId) {
        await db
          .from("orders")
          .update({ payment_status: "failed", updated_at: new Date().toISOString() })
          .eq("id", orderId);
      }
    }

    return new Response("ok", { status: 200 });
  },
});

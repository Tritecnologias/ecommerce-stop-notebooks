import Stripe from "stripe";
import type { Order, OrderItem } from "@/lib/types";

function getStripe(secretKey: string) {
  return new Stripe(secretKey, {
    apiVersion: "2025-06-30.basil",
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export async function createCardCheckoutSession(
  order: Order,
  items: OrderItem[],
  secretKey: string,
  appUrl: string,
) {
  const stripe = getStripe(secretKey);
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: items.map((item) => ({
      price_data: {
        currency: "brl",
        product_data: {
          name: `${item.product_name} (${item.size})`,
          images: item.product_image ? [item.product_image] : undefined,
        },
        unit_amount: Math.round(item.unit_price * 100),
      },
      quantity: item.quantity,
    })),
    mode: "payment",
    success_url: `${appUrl}/sucesso?id=${order.id}`,
    cancel_url: `${appUrl}/checkout`,
    customer_email: order.customer_email,
    metadata: { order_id: order.id, order_number: order.order_number },
  });
  return {
    paymentId: session.id,
    redirectUrl: session.url!,
    status: "pending" as const,
  };
}

export async function createPixIntent(order: Order, secretKey: string) {
  const stripe = getStripe(secretKey);
  const pi = await stripe.paymentIntents.create({
    amount: Math.round(order.total * 100),
    currency: "brl",
    payment_method_types: ["pix"],
    payment_method_data: { type: "pix" },
    confirm: true,
    metadata: { order_id: order.id, order_number: order.order_number },
  });
  const pixDisplay = (pi.next_action as any)?.pix_display_qr_code;
  return {
    paymentId: pi.id,
    qrCode: pixDisplay?.data as string | undefined,
    qrCodeBase64: pixDisplay?.image_url_png as string | undefined,
    expiresAt: pixDisplay?.expires_at
      ? new Date(pixDisplay.expires_at * 1000).toISOString()
      : undefined,
    status: "pending" as const,
  };
}

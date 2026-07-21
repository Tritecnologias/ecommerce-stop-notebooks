// Abstração central de pagamento — delega para o gateway correto
import type { Order, OrderItem, PaymentGateway, PaymentMethod, PaymentResult } from "@/lib/types";
import * as mp from "./mercadopago";
import * as stripeLib from "./stripe";
import * as pag from "./pagseguro";

function getGateway(method: PaymentMethod): PaymentGateway {
  const env = process.env;
  if (method === "pix") return (env.PIX_GATEWAY as PaymentGateway) || "mercadopago";
  if (method === "boleto") return (env.BOLETO_GATEWAY as PaymentGateway) || "mercadopago";
  return (env.CARD_GATEWAY as PaymentGateway) || "stripe";
}

export async function processPayment(
  order: Order,
  items: OrderItem[],
  appUrl: string,
): Promise<PaymentResult> {
  const gateway = getGateway(order.payment_method);

  // Valida credenciais antes de chamar o gateway
  const missing: string[] = [];
  if (gateway === "mercadopago" && !process.env.MERCADOPAGO_ACCESS_TOKEN) missing.push("MERCADOPAGO_ACCESS_TOKEN");
  if (gateway === "stripe" && !process.env.STRIPE_SECRET_KEY) missing.push("STRIPE_SECRET_KEY");
  if (gateway === "pagseguro" && !process.env.PAGSEGURO_TOKEN) missing.push("PAGSEGURO_TOKEN");
  if (missing.length > 0) {
    throw new Error(
      `Gateway "${gateway}" não configurado. Variável ausente: ${missing.join(", ")}. ` +
      `Use o PIX de Teste no Admin → Configurações para testar sem gateway.`,
    );
  }

  if (gateway === "mercadopago") {
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN!;
    if (order.payment_method === "pix") {
      const r = await mp.createPixPayment(order, token);
      return { ...r, orderId: order.id, orderNumber: order.order_number, gateway, paymentMethod: order.payment_method };
    }
    if (order.payment_method === "boleto") {
      const r = await mp.createBoletoPayment(order, token);
      return { ...r, orderId: order.id, orderNumber: order.order_number, gateway, paymentMethod: order.payment_method };
    }
    const r = await mp.createCardPreference(order, items, token, {
      success: `${appUrl}/sucesso?id=${order.id}`,
      failure: `${appUrl}/checkout`,
    });
    return { ...r, orderId: order.id, orderNumber: order.order_number, gateway, paymentMethod: order.payment_method };
  }

  if (gateway === "stripe") {
    const secretKey = process.env.STRIPE_SECRET_KEY!;
    if (order.payment_method === "pix") {
      const r = await stripeLib.createPixIntent(order, secretKey);
      return { ...r, orderId: order.id, orderNumber: order.order_number, gateway, paymentMethod: order.payment_method };
    }
    const r = await stripeLib.createCardCheckoutSession(order, items, secretKey, appUrl);
    return { ...r, orderId: order.id, orderNumber: order.order_number, gateway, paymentMethod: order.payment_method };
  }

  // pagseguro
  const token = process.env.PAGSEGURO_TOKEN!;
  if (order.payment_method === "pix") {
    const r = await pag.createPixCharge(order, token);
    return { ...r, orderId: order.id, orderNumber: order.order_number, gateway, paymentMethod: order.payment_method };
  }
  if (order.payment_method === "boleto") {
    const r = await pag.createBoletoCharge(order, token);
    return { ...r, orderId: order.id, orderNumber: order.order_number, gateway, paymentMethod: order.payment_method };
  }
  const r = await pag.createCardOrder(order, items, token, appUrl);
  return { ...r, orderId: order.id, orderNumber: order.order_number, gateway, paymentMethod: order.payment_method };
}

export { getGateway };

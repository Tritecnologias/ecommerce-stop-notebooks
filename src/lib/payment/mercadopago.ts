import type { Order, OrderItem } from "@/lib/types";

const MP_BASE = "https://api.mercadopago.com";

function mpHeaders(token: string, idempotencyKey?: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
  };
}

export async function createPixPayment(order: Order, token: string) {
  const res = await fetch(`${MP_BASE}/v1/payments`, {
    method: "POST",
    headers: mpHeaders(token, order.id + "_pix"),
    body: JSON.stringify({
      transaction_amount: order.total,
      description: `Pedido ${order.order_number} — SD Comércio`,
      payment_method_id: "pix",
      date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      payer: {
        email: order.customer_email,
        first_name: order.customer_name.split(" ")[0],
        last_name: order.customer_name.split(" ").slice(1).join(" ") || ".",
        identification: {
          type: "CPF",
          number: order.customer_cpf?.replace(/\D/g, "") ?? "",
        },
      },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "MercadoPago Pix error");
  return {
    paymentId: String(data.id),
    qrCode: data.point_of_interaction?.transaction_data?.qr_code as string | undefined,
    qrCodeBase64: data.point_of_interaction?.transaction_data?.qr_code_base64 as string | undefined,
    expiresAt: data.date_of_expiration as string | undefined,
    status: "pending" as const,
  };
}

export async function createBoletoPayment(order: Order, token: string) {
  const res = await fetch(`${MP_BASE}/v1/payments`, {
    method: "POST",
    headers: mpHeaders(token, order.id + "_boleto"),
    body: JSON.stringify({
      transaction_amount: order.total,
      description: `Pedido ${order.order_number} — SD Comércio`,
      payment_method_id: "bolbradesco",
      payer: {
        email: order.customer_email,
        first_name: order.customer_name.split(" ")[0],
        last_name: order.customer_name.split(" ").slice(1).join(" ") || ".",
        identification: {
          type: "CPF",
          number: order.customer_cpf?.replace(/\D/g, "") ?? "",
        },
        address: {
          zip_code: order.shipping_cep?.replace(/\D/g, "") ?? "",
          street_name: order.shipping_street ?? "",
          street_number: order.shipping_number ?? "",
          neighborhood: order.shipping_neighborhood ?? "",
          city: order.shipping_city ?? "",
          federal_unit: order.shipping_state ?? "",
        },
      },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "MercadoPago Boleto error");
  return {
    paymentId: String(data.id),
    barcode: data.barcode?.content as string | undefined,
    barcodeUrl: data.transaction_details?.external_resource_url as string | undefined,
    expiresAt: data.date_of_expiration as string | undefined,
    status: "pending" as const,
  };
}

export async function createCardPreference(
  order: Order,
  items: OrderItem[],
  token: string,
  backUrls: { success: string; failure: string },
) {
  const res = await fetch(`${MP_BASE}/checkout/preferences`, {
    method: "POST",
    headers: mpHeaders(token),
    body: JSON.stringify({
      items: items.map((item) => ({
        id: item.product_slug + "_" + item.size,
        title: `${item.product_name} (${item.size})`,
        quantity: item.quantity,
        unit_price: item.unit_price,
        currency_id: "BRL",
        picture_url: item.product_image ?? undefined,
      })),
      payer: {
        name: order.customer_name,
        email: order.customer_email,
        identification: {
          type: "CPF",
          number: order.customer_cpf?.replace(/\D/g, "") ?? "",
        },
        address: {
          zip_code: order.shipping_cep?.replace(/\D/g, "") ?? "",
          street_name: order.shipping_street ?? "",
          street_number: order.shipping_number ?? "",
        },
      },
      back_urls: { success: backUrls.success, failure: backUrls.failure, pending: backUrls.success },
      auto_return: "approved",
      external_reference: order.id,
      statement_descriptor: "SD Comercio",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "MercadoPago Checkout error");
  return {
    paymentId: data.id as string,
    redirectUrl: (data.init_point ?? data.sandbox_init_point) as string,
    status: "pending" as const,
  };
}

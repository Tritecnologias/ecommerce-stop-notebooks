import type { Order, OrderItem } from "@/lib/types";

const PS_BASE = "https://api.pagseguro.com";

function psHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function createPixCharge(order: Order, token: string) {
  const res = await fetch(`${PS_BASE}/charges`, {
    method: "POST",
    headers: psHeaders(token),
    body: JSON.stringify({
      reference_id: order.id,
      description: `Pedido ${order.order_number} — SD Comércio`,
      amount: { value: Math.round(order.total * 100), currency: "BRL" },
      payment_method: { type: "PIX", installments: 1, capture: true },
      notification_urls: [`${process.env.APP_URL ?? ""}/api/webhooks/pagseguro`],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data.error_messages ?? data));
  const qr = data.qr_codes?.[0];
  return {
    paymentId: data.id as string,
    qrCode: qr?.text as string | undefined,
    qrCodeBase64: qr?.links?.find((l: { media: string }) => l.media === "image/png")?.href as string | undefined,
    expiresAt: qr?.expiration_date as string | undefined,
    status: "pending" as const,
  };
}

export async function createBoletoCharge(order: Order, token: string) {
  const due = new Date();
  due.setDate(due.getDate() + 3);
  const dueDate = due.toISOString().split("T")[0];

  const res = await fetch(`${PS_BASE}/charges`, {
    method: "POST",
    headers: psHeaders(token),
    body: JSON.stringify({
      reference_id: order.id,
      description: `Pedido ${order.order_number} — SD Comércio`,
      amount: { value: Math.round(order.total * 100), currency: "BRL" },
      payment_method: {
        type: "BOLETO",
        boleto: {
          due_date: dueDate,
          instruction_lines: {
            line_1: `Pedido ${order.order_number} — SD Comércio`,
            line_2: `Vencimento: ${due.toLocaleDateString("pt-BR")}`,
          },
          holder: {
            name: order.customer_name,
            tax_id: order.customer_cpf?.replace(/\D/g, "") ?? "",
            email: order.customer_email,
            address: {
              street: order.shipping_street ?? "",
              number: order.shipping_number ?? "",
              complement: order.shipping_complement ?? "",
              locality: order.shipping_neighborhood ?? "",
              city: order.shipping_city ?? "",
              region_code: order.shipping_state ?? "",
              country: "BRA",
              postal_code: order.shipping_cep?.replace(/\D/g, "") ?? "",
            },
          },
        },
      },
      notification_urls: [`${process.env.APP_URL ?? ""}/api/webhooks/pagseguro`],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data.error_messages ?? data));
  const boleto = data.payment_method?.boleto;
  return {
    paymentId: data.id as string,
    barcode: boleto?.barcode as string | undefined,
    barcodeUrl: boleto?.pdf?.href as string | undefined,
    expiresAt: boleto?.due_date as string | undefined,
    status: "pending" as const,
  };
}

export async function createCardOrder(
  order: Order,
  items: OrderItem[],
  token: string,
  appUrl: string,
) {
  const res = await fetch(`${PS_BASE}/orders`, {
    method: "POST",
    headers: psHeaders(token),
    body: JSON.stringify({
      reference_id: order.id,
      customer: {
        name: order.customer_name,
        email: order.customer_email,
        tax_id: order.customer_cpf?.replace(/\D/g, "") ?? "",
        phones: order.customer_phone
          ? [
              {
                country: "55",
                area: order.customer_phone.replace(/\D/g, "").slice(0, 2),
                number: order.customer_phone.replace(/\D/g, "").slice(2),
                type: "MOBILE",
              },
            ]
          : [],
      },
      items: items.map((item) => ({
        reference_id: `${item.product_slug}_${item.size}`,
        name: `${item.product_name} (${item.size})`,
        quantity: item.quantity,
        unit_amount: Math.round(item.unit_price * 100),
      })),
      shipping: {
        address: {
          street: order.shipping_street ?? "",
          number: order.shipping_number ?? "",
          complement: order.shipping_complement ?? "",
          locality: order.shipping_neighborhood ?? "",
          city: order.shipping_city ?? "",
          region_code: order.shipping_state ?? "",
          country: "BRA",
          postal_code: order.shipping_cep?.replace(/\D/g, "") ?? "",
        },
      },
      charges: [
        {
          reference_id: order.id + "_charge",
          description: `Pedido ${order.order_number}`,
          amount: { value: Math.round(order.total * 100), currency: "BRL" },
          payment_method: {
            type: "CREDIT_CARD",
            installments: 1,
            capture: true,
            soft_descriptor: "SD Comercio",
          },
        },
      ],
      notification_urls: [`${process.env.APP_URL ?? ""}/api/webhooks/pagseguro`],
      redirect_url: `${appUrl}/sucesso?id=${order.id}`,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data.error_messages ?? data));
  const link = (data.links as { rel: string; href: string }[] | undefined)?.find(
    (l) => l.rel === "pay",
  )?.href;
  return {
    paymentId: data.id as string,
    redirectUrl: link,
    status: "pending" as const,
  };
}

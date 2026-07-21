import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type WhatsAppSettings = {
  enabled: boolean;
  supportPhone: string;  // Número público de suporte (wa.me link)
  adminPhone: string;    // Número que recebe notificações de pedidos
  zapiInstanceId: string;
  zapiToken: string;
};

const DEFAULT_SETTINGS: WhatsAppSettings = {
  enabled: false,
  supportPhone: "",
  adminPhone: "",
  zapiInstanceId: "",
  zapiToken: "",
};

// ─── CRUD settings ────────────────────────────────────────────────────────────

export const getWhatsAppSettings = createServerFn().handler(
  async (): Promise<WhatsAppSettings> => {
    const db = createSupabaseAdmin();
    const { data } = await db
      .from("store_settings")
      .select("value")
      .eq("key", "whatsapp")
      .single();
    if (!data) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(data.value as Partial<WhatsAppSettings>) };
  },
);

const WhatsAppSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  supportPhone: z.string().default(""),
  adminPhone: z.string().default(""),
  zapiInstanceId: z.string().default(""),
  zapiToken: z.string().default(""),
});

export const updateWhatsAppSettings = createServerFn()
  .inputValidator((input: unknown) => WhatsAppSettingsSchema.parse(input))
  .handler(async ({ data }) => {
    const db = createSupabaseAdmin();
    await db.from("store_settings").upsert(
      { key: "whatsapp", value: data as unknown as { [key: string]: string | boolean }, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
    return data;
  });

// ─── Envio via Z-API ──────────────────────────────────────────────────────────

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

async function sendZAPI(
  settings: WhatsAppSettings,
  phone: string,
  message: string,
): Promise<boolean> {
  if (!settings.enabled || !settings.zapiInstanceId || !settings.zapiToken) return false;
  if (!phone) return false;

  try {
    const res = await fetch(
      `https://api.z-api.io/instances/${settings.zapiInstanceId}/token/${settings.zapiToken}/send-text`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formatPhone(phone), message }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

async function loadSettings(): Promise<WhatsAppSettings> {
  const db = createSupabaseAdmin();
  const { data } = await db
    .from("store_settings")
    .select("value")
    .eq("key", "whatsapp")
    .single();
  return data ? { ...DEFAULT_SETTINGS, ...(data.value as Partial<WhatsAppSettings>) } : DEFAULT_SETTINGS;
}

// ─── Notificação: novo pedido → admin ─────────────────────────────────────────

export async function notifyAdminNewOrder(orderId: string): Promise<void> {
  const db = createSupabaseAdmin();
  const [settings, { data: order }] = await Promise.all([
    loadSettings(),
    db
      .from("orders")
      .select("order_number, customer_name, total, payment_method, order_items(product_name, quantity, size)")
      .eq("id", orderId)
      .single(),
  ]);

  if (!settings.enabled || !settings.adminPhone || !order) return;

  const PAY: Record<string, string> = { pix: "Pix", credit_card: "Cartão", boleto: "Boleto" };
  const items = (order.order_items ?? [])
    .slice(0, 4)
    .map((i) => `  • ${i.product_name} ×${i.quantity} (${i.size})`)
    .join("\n");
  const extra = (order.order_items?.length ?? 0) > 4
    ? `\n  + ${(order.order_items?.length ?? 0) - 4} item(s)…`
    : "";

  const msg = [
    `🛍 *Novo pedido #${order.order_number}*`,
    ``,
    `👤 ${order.customer_name}`,
    `💳 ${PAY[order.payment_method] ?? order.payment_method}`,
    `💰 R$ ${order.total.toFixed(2).replace(".", ",")}`,
    ``,
    `*Itens:*`,
    items + extra,
  ].join("\n");

  await sendZAPI(settings, settings.adminPhone, msg);
}

// ─── Notificação: pedido confirmado → cliente ──────────────────────────────────

export async function notifyCustomerOrderConfirmed(orderId: string): Promise<void> {
  const db = createSupabaseAdmin();
  const [settings, { data: order }] = await Promise.all([
    loadSettings(),
    db
      .from("orders")
      .select("order_number, customer_name, customer_phone, total, order_items(product_name, quantity, size)")
      .eq("id", orderId)
      .single(),
  ]);

  if (!settings.enabled || !order?.customer_phone) return;

  const firstName = order.customer_name.trim().split(" ")[0];
  const items = (order.order_items ?? [])
    .slice(0, 3)
    .map((i) => `  • ${i.product_name} (${i.size}) ×${i.quantity}`)
    .join("\n");
  const extra = (order.order_items?.length ?? 0) > 3
    ? `\n  + ${(order.order_items?.length ?? 0) - 3} item(s)…`
    : "";

  const msg = [
    `✅ *Pedido confirmado!*`,
    ``,
    `Oi ${firstName}! Seu pedido *#${order.order_number}* foi aprovado. 🎉`,
    ``,
    `*Itens:*`,
    items + extra,
    ``,
    `💰 *Total: R$ ${order.total.toFixed(2).replace(".", ",")}*`,
    ``,
    `Em breve seu pedido estará em preparação.`,
    `Avisaremos aqui quando sair para entrega! 📦`,
    ``,
    `_Secret Desire — Aromas que marcam_ 🌿`,
  ].join("\n");

  await sendZAPI(settings, order.customer_phone, msg);
}

// ─── Notificação: pedido enviado → cliente ────────────────────────────────────

export async function notifyCustomerShipped(orderId: string): Promise<void> {
  const db = createSupabaseAdmin();
  const [settings, { data: order }] = await Promise.all([
    loadSettings(),
    db
      .from("orders")
      .select("order_number, customer_name, customer_phone, tracking_code")
      .eq("id", orderId)
      .single(),
  ]);

  if (!settings.enabled || !order?.customer_phone) return;

  const firstName = order.customer_name.trim().split(" ")[0];
  const trackingBlock = order.tracking_code
    ? [
        ``,
        `📦 *Rastreio:* \`${order.tracking_code}\``,
        `🔍 https://rastreamento.correios.com.br/app/index.php?objetos=${order.tracking_code}`,
      ].join("\n")
    : "";

  const msg = [
    `🚚 *Seu pedido saiu para entrega!*`,
    ``,
    `Oi ${firstName}! O pedido *#${order.order_number}* foi enviado. 📬`,
    trackingBlock,
    ``,
    `_Secret Desire — Aromas que marcam_ 🌿`,
  ].join("\n");

  await sendZAPI(settings, order.customer_phone, msg);
}

// ─── Server functions expostas para uso no frontend ──────────────────────────

export const triggerShippingNotification = createServerFn()
  .inputValidator((orderId: unknown) => z.string().parse(orderId))
  .handler(async ({ data: orderId }) => {
    await notifyCustomerShipped(orderId);
    return { sent: true };
  });

export const testWhatsAppConnection = createServerFn().handler(async (): Promise<{ ok: boolean; message: string }> => {
  const settings = await loadSettings();
  if (!settings.zapiInstanceId || !settings.zapiToken) {
    return { ok: false, message: "Instance ID e Token são obrigatórios" };
  }
  try {
    const res = await fetch(
      `https://api.z-api.io/instances/${settings.zapiInstanceId}/token/${settings.zapiToken}/status`,
    );
    if (!res.ok) return { ok: false, message: `Z-API retornou ${res.status}` };
    const json = await res.json() as { connected?: boolean };
    return json.connected
      ? { ok: true, message: "WhatsApp conectado!" }
      : { ok: false, message: "Instância desconectada — abra o WhatsApp e escaneie o QR Code no painel Z-API." };
  } catch {
    return { ok: false, message: "Não foi possível conectar à Z-API" };
  }
});

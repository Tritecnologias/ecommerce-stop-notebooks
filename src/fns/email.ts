import type { Order } from "@/lib/types";
import { formatBRL } from "@/lib/cart";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

const BRAND_HEX = "#4ade80";

// ─── Nodemailer transport (singleton por processo) ────────────────────────────

let _transporter: Transporter | null = null;

async function getTransporter(): Promise<Transporter> {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST;

  if (!host) {
    // Ambiente local: cria conta Ethereal automaticamente.
    // Emails NÃO são entregues — visualize em https://ethereal.email/messages
    const test = await nodemailer.createTestAccount();
    _transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: test.user, pass: test.pass },
    });
    console.log("[mailer] ✉  Modo Ethereal ativo (dev local)");
    console.log(`[mailer]    Usuário: ${test.user} | https://ethereal.email/messages`);
  } else {
    // Produção: usa SMTP configurado via variáveis de ambiente
    _transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  return _transporter;
}

// ─── Função de envio ──────────────────────────────────────────────────────────

const FROM = process.env.EMAIL_FROM ?? "Secret Desire <noreply@secretdesire.com.br>";

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    const transport = await getTransporter();
    const info = await transport.sendMail({ from: FROM, to, subject, html });

    // Ethereal: imprime o link de pré-visualização no terminal
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) {
      console.log(`[mailer] 👁  Preview do email → ${preview}`);
    } else {
      console.log(`[mailer] ✅  Email enviado para ${to} (${info.messageId})`);
    }
  } catch (err) {
    console.error("[mailer] ❌  Falha ao enviar:", err);
  }
}

// ─── Layout base do e-mail ────────────────────────────────────────────────────
function emailLayout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e5e5e5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="padding:0 0 24px 0;text-align:center;">
              <table cellpadding="0" cellspacing="0" style="display:inline-table;">
                <tr>
                  <td style="background:${BRAND_HEX};width:10px;height:10px;border-radius:50%;vertical-align:middle;"></td>
                  <td style="padding-left:8px;font-size:20px;font-weight:700;letter-spacing:-0.5px;color:#fff;vertical-align:middle;">
                    Secret Desire
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#141414;border:1px solid #262626;border-radius:12px;padding:32px;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 0 0;text-align:center;font-size:12px;color:#555;">
              © 2026 Secret Desire · Aromas que marcam.
              <br />
              Você está recebendo este e-mail porque realizou uma compra em nosso site.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Tabela de itens do pedido ────────────────────────────────────────────────
function itemsTable(order: Order): string {
  const items = order.order_items ?? [];
  const rows = items.map(
    (item) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #262626;font-size:14px;color:#d4d4d4;">
        ${item.product_name}
        <span style="color:#737373;font-size:12px;"> · ${item.size} · ${item.quantity}×</span>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #262626;font-size:14px;text-align:right;white-space:nowrap;">
        ${formatBRL(item.unit_price * item.quantity)}
      </td>
    </tr>`,
  ).join("");

  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
    <tr>
      <td style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#555;padding-bottom:8px;border-bottom:1px solid #333;">Produto</td>
      <td style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#555;padding-bottom:8px;border-bottom:1px solid #333;text-align:right;">Subtotal</td>
    </tr>
    ${rows}
    <tr>
      <td style="padding-top:12px;font-size:12px;color:#737373;">Subtotal</td>
      <td style="padding-top:12px;font-size:12px;color:#737373;text-align:right;">${formatBRL(order.subtotal)}</td>
    </tr>
    ${order.discount > 0 ? `<tr>
      <td style="padding-top:6px;font-size:12px;color:#737373;">Desconto</td>
      <td style="padding-top:6px;font-size:12px;color:${BRAND_HEX};text-align:right;">−${formatBRL(order.discount)}</td>
    </tr>` : ""}
    <tr>
      <td style="padding-top:6px;font-size:12px;color:#737373;">Frete</td>
      <td style="padding-top:6px;font-size:12px;color:#737373;text-align:right;">${order.shipping_cost === 0 ? "Grátis" : formatBRL(order.shipping_cost)}</td>
    </tr>
    <tr>
      <td style="padding-top:12px;border-top:1px solid #333;font-size:16px;font-weight:700;color:#fff;">Total</td>
      <td style="padding-top:12px;border-top:1px solid #333;font-size:16px;font-weight:700;color:${BRAND_HEX};text-align:right;">${formatBRL(order.total)}</td>
    </tr>
  </table>`;
}

// ─── Endereço de entrega ──────────────────────────────────────────────────────
function addressBlock(order: Order): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;background:#1a1a1a;border-radius:8px;padding:16px;">
    <tr>
      <td>
        <p style="margin:0 0 6px 0;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#555;">Endereço de entrega</p>
        <p style="margin:0;font-size:14px;color:#d4d4d4;line-height:1.6;">
          ${order.shipping_street}, ${order.shipping_number}
          ${order.shipping_complement ? ` — ${order.shipping_complement}` : ""}
          <br />${order.shipping_neighborhood} · ${order.shipping_city}/${order.shipping_state}
          <br />CEP ${order.shipping_cep}
        </p>
      </td>
    </tr>
  </table>`;
}

// ─── TEMPLATES ────────────────────────────────────────────────────────────────

export async function sendOrderConfirmation(order: Order): Promise<void> {
  const paymentMethodLabel: Record<string, string> = {
    pix: "Pix",
    credit_card: "Cartão de crédito",
    boleto: "Boleto bancário",
  };

  const body = `
    <h1 style="margin:0 0 6px 0;font-size:24px;font-weight:700;color:#fff;">
      Pedido recebido! 🎉
    </h1>
    <p style="margin:0 0 24px 0;font-size:15px;color:#a3a3a3;">
      Olá, <strong style="color:#e5e5e5;">${order.customer_name.split(" ")[0]}</strong>!
      Seu pedido foi realizado com sucesso.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:8px;padding:16px;margin-bottom:4px;">
      <tr>
        <td>
          <p style="margin:0 0 4px 0;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#555;">Número do pedido</p>
          <p style="margin:0;font-size:22px;font-weight:700;color:${BRAND_HEX};font-family:monospace;">#${order.order_number}</p>
        </td>
        <td style="text-align:right;vertical-align:top;">
          <p style="margin:0 0 4px 0;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#555;">Pagamento</p>
          <p style="margin:0;font-size:14px;color:#e5e5e5;">${paymentMethodLabel[order.payment_method] ?? order.payment_method}</p>
        </td>
      </tr>
    </table>

    ${itemsTable(order)}
    ${addressBlock(order)}

    <p style="margin:28px 0 0 0;font-size:14px;color:#737373;line-height:1.6;">
      Você pode acompanhar o status do pedido acessando
      <a href="https://Secret Desire.com.br/conta/pedidos" style="color:${BRAND_HEX};text-decoration:none;">Meus pedidos</a>.
      Em caso de dúvidas, responda este e-mail.
    </p>`;

  await sendEmail(
    order.customer_email,
    `Pedido #${order.order_number} recebido — SD Comércio`,
    emailLayout(`Pedido #${order.order_number} recebido`, body),
  );
}

// ─── E-mail de atualização de status ─────────────────────────────────────────
const STATUS_MESSAGES: Record<string, { emoji: string; title: string; subtitle: string }> = {
  confirmed: {
    emoji: "✅",
    title: "Pagamento confirmado!",
    subtitle: "Ótimo! Recebemos a confirmação do seu pagamento e já estamos preparando seu pedido.",
  },
  processing: {
    emoji: "📦",
    title: "Pedido em preparação",
    subtitle: "Nossa equipe está separando e embalando seu pedido com todo cuidado.",
  },
  shipped: {
    emoji: "🚚",
    title: "Pedido enviado!",
    subtitle: "Seu pedido saiu para entrega. Acompanhe pelo código de rastreio abaixo.",
  },
  delivered: {
    emoji: "🎉",
    title: "Pedido entregue!",
    subtitle: "Seu pedido foi entregue! Esperamos que você ame as fragrâncias. Obrigado pela confiança.",
  },
  cancelled: {
    emoji: "❌",
    title: "Pedido cancelado",
    subtitle: "Seu pedido foi cancelado. Se você não solicitou o cancelamento, entre em contato conosco.",
  },
};

// ─── E-mail de volta ao estoque ──────────────────────────────────────────────
export async function sendBackInStockEmail(
  to: string,
  productName: string,
  productSlug: string,
): Promise<void> {
  const productUrl = `https://secretdesire.com.br/produto/${productSlug}`;

  const body = `
    <h1 style="margin:0 0 6px 0;font-size:24px;font-weight:700;color:#fff;">
      🔔 Seu item está disponível!
    </h1>
    <p style="margin:0 0 24px 0;font-size:15px;color:#a3a3a3;">
      Boas notícias! O produto que você estava esperando voltou ao estoque.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#1a1a1a;border-radius:8px;padding:20px;margin-bottom:24px;">
      <tr>
        <td>
          <p style="margin:0 0 4px 0;font-size:11px;text-transform:uppercase;
            letter-spacing:1px;color:#555;">Produto disponível</p>
          <p style="margin:0;font-size:18px;font-weight:700;color:#fff;">${productName}</p>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <a href="${productUrl}"
            style="display:inline-block;background:${BRAND_HEX};color:#000;font-weight:700;
              font-size:14px;padding:14px 32px;border-radius:8px;text-decoration:none;
              letter-spacing:0.5px;">
            Ver produto agora →
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:24px 0 0 0;font-size:12px;color:#555;line-height:1.6;text-align:center;">
      Corra! O estoque pode esgotar novamente em breve.<br/>
      <a href="${productUrl}" style="color:${BRAND_HEX};text-decoration:none;">${productUrl}</a>
    </p>`;

  await sendEmail(
    to,
    `Seu item está disponível novamente`,
    emailLayout(`${productName} disponível`, body),
  );
}

// ─── E-mail de atualização de status ─────────────────────────────────────────
export async function sendStatusUpdate(order: Order): Promise<void> {
  const msg = STATUS_MESSAGES[order.status];
  if (!msg) return; // não envia para status sem mensagem definida

  const trackingBlock =
    order.tracking_code && order.status === "shipped"
      ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;background:#1a1a1a;border-radius:8px;padding:16px;">
          <tr>
            <td>
              <p style="margin:0 0 4px 0;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#555;">Código de rastreio</p>
              <p style="margin:0;font-size:18px;font-weight:700;color:${BRAND_HEX};font-family:monospace;">${order.tracking_code}</p>
              <p style="margin:6px 0 0 0;font-size:12px;color:#737373;">
                Rastreie em
                <a href="https://www.correios.com.br/rastreamento" style="color:${BRAND_HEX};text-decoration:none;">correios.com.br</a>
              </p>
            </td>
          </tr>
        </table>`
      : "";

  const body = `
    <h1 style="margin:0 0 6px 0;font-size:24px;font-weight:700;color:#fff;">
      ${msg.emoji} ${msg.title}
    </h1>
    <p style="margin:0 0 24px 0;font-size:15px;color:#a3a3a3;">
      Olá, <strong style="color:#e5e5e5;">${order.customer_name.split(" ")[0]}</strong>!
      ${msg.subtitle}
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:8px;padding:16px;">
      <tr>
        <td>
          <p style="margin:0 0 4px 0;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#555;">Pedido</p>
          <p style="margin:0;font-size:20px;font-weight:700;color:${BRAND_HEX};font-family:monospace;">#${order.order_number}</p>
        </td>
        <td style="text-align:right;vertical-align:top;">
          <p style="margin:0 0 4px 0;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#555;">Total</p>
          <p style="margin:0;font-size:16px;font-weight:700;color:#fff;">${formatBRL(order.total)}</p>
        </td>
      </tr>
    </table>

    ${trackingBlock}

    <p style="margin:28px 0 0 0;font-size:14px;color:#737373;">
      <a href="https://Secret Desire.com.br/conta/pedidos" style="color:${BRAND_HEX};text-decoration:none;">Ver meus pedidos →</a>
    </p>`;

  await sendEmail(
    order.customer_email,
    `Atualização do pedido #${order.order_number}`,
    emailLayout(msg.title, body),
  );
}

// ─── Alerta de estoque baixo → admin ─────────────────────────────────────────

export async function sendLowStockAlert(
  adminEmail: string,
  productName: string,
  productSlug: string,
  currentStock: number,
  threshold: number,
): Promise<void> {
  const body = `
    <p style="margin:0 0 20px 0;font-size:15px;color:#a3a3a3;">
      ⚠️ O produto abaixo está com <strong style="color:#facc15;">estoque crítico</strong>.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:8px;padding:16px;margin-bottom:20px;">
      <tr>
        <td>
          <p style="margin:0 0 4px 0;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#555;">Produto</p>
          <p style="margin:0;font-size:17px;font-weight:700;color:#fff;">${productName}</p>
        </td>
        <td style="text-align:right;vertical-align:top;">
          <p style="margin:0 0 4px 0;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#555;">Estoque atual</p>
          <p style="margin:0;font-size:22px;font-weight:800;color:#ef4444;">${currentStock} un.</p>
          <p style="margin:2px 0 0 0;font-size:10px;color:#555;">Limite: ${threshold} un.</p>
        </td>
      </tr>
    </table>

    <p style="margin:0;">
      <a href="https://Secret Desire.com.br/admin/produtos"
         style="display:inline-block;background:${BRAND_HEX};color:#000;font-weight:700;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;">
        Gerenciar estoque →
      </a>
    </p>`;

  await sendEmail(
    adminEmail,
    `⚠️ Estoque crítico — ${productName} (${currentStock} un. restantes)`,
    emailLayout("Alerta de estoque baixo", body),
  );
}

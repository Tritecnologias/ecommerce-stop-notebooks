/**
 * Integração com Correios API v2
 *
 * Fluxo: autenticar com cartão de postagem → criar pré-postagem → retornar
 *        etiqueta (código de rastreio) + PDF da etiqueta.
 *
 * Docs: https://www.correios.com.br/atendimento/developers
 * Homologação: https://apihom.correios.com.br
 * Produção:    https://api.correios.com.br
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase";
import type { Order } from "@/lib/types";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type CorreiosSettings = {
  /** Login do sistema Correios (e-mail ou CPF/CNPJ) */
  usuario: string;
  /** Senha do sistema Correios */
  senha: string;
  /** Número do cartão de postagem (contratado) */
  cartaoPostagem: string;
  /** Número do contrato */
  contrato: string;
  // ── Dados do remetente ──────────────────────────────────────────────────
  remetenteNome: string;
  remetenteCpfCnpj: string;
  remetenteCep: string;
  remetenteLogradouro: string;
  remetenteNumero: string;
  remetenteBairro: string;
  remetenteCidade: string;
  remetenteUf: string;
  remetenteEmail: string;
  // ── Padrões de embalagem ────────────────────────────────────────────────
  /** Código do serviço: 03220=SEDEX, 03298=PAC, 03158=SEDEX10, 04316=Mini */
  codigoServico: string;
  /** Peso em gramas */
  pesoGramas: number;
  /** Comprimento em cm */
  comprimentoCm: number;
  /** Altura em cm */
  alturaCm: number;
  /** Largura em cm */
  larguraCm: number;
  /** Ambiente da API */
  ambiente: "producao" | "homologacao";
};

const DEFAULT_CORREIOS: CorreiosSettings = {
  usuario: "",
  senha: "",
  cartaoPostagem: "",
  contrato: "",
  remetenteNome: "",
  remetenteCpfCnpj: "",
  remetenteCep: "",
  remetenteLogradouro: "",
  remetenteNumero: "",
  remetenteBairro: "",
  remetenteCidade: "",
  remetenteUf: "",
  remetenteEmail: "",
  codigoServico: "03298",
  pesoGramas: 300,
  comprimentoCm: 20,
  alturaCm: 5,
  larguraCm: 15,
  ambiente: "homologacao",
};

export const CORREIOS_SERVICES = [
  { code: "03220", label: "SEDEX" },
  { code: "03298", label: "PAC" },
  { code: "03158", label: "SEDEX 10" },
  { code: "04316", label: "Mini Envios" },
] as const;

// ─── Settings CRUD ────────────────────────────────────────────────────────────

export const getCorreiosSettings = createServerFn()
  .handler(async (): Promise<CorreiosSettings> => {
    const db = createSupabaseAdmin();
    const { data } = await db
      .from("store_settings")
      .select("value")
      .eq("key", "correios_settings")
      .single();
    if (!data) return DEFAULT_CORREIOS;
    return { ...DEFAULT_CORREIOS, ...(data.value as Partial<CorreiosSettings>) };
  });

const CorreiosSettingsSchema = z.object({
  usuario: z.string(),
  senha: z.string(),
  cartaoPostagem: z.string(),
  contrato: z.string(),
  remetenteNome: z.string(),
  remetenteCpfCnpj: z.string(),
  remetenteCep: z.string(),
  remetenteLogradouro: z.string(),
  remetenteNumero: z.string(),
  remetenteBairro: z.string(),
  remetenteCidade: z.string(),
  remetenteUf: z.string(),
  remetenteEmail: z.string(),
  codigoServico: z.string(),
  pesoGramas: z.number().int().positive(),
  comprimentoCm: z.number().positive(),
  alturaCm: z.number().positive(),
  larguraCm: z.number().positive(),
  ambiente: z.enum(["producao", "homologacao"]),
});

export const updateCorreiosSettings = createServerFn()
  .inputValidator((input: unknown) => CorreiosSettingsSchema.parse(input))
  .handler(async ({ data }) => {
    const db = createSupabaseAdmin();
    const { error } = await db
      .from("store_settings")
      .upsert(
        { key: "correios_settings", value: data, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    if (error) throw new Error(error.message);
  });

// ─── Teste de conexão ─────────────────────────────────────────────────────────

export const testCorreiosConnection = createServerFn()
  .handler(async (): Promise<{ ok: boolean; message: string }> => {
    const db = createSupabaseAdmin();
    const { data: cfgRow } = await db
      .from("store_settings")
      .select("value")
      .eq("key", "correios_settings")
      .single();

    if (!cfgRow?.value) return { ok: false, message: "Correios não configurado." };
    const settings = { ...DEFAULT_CORREIOS, ...(cfgRow.value as Partial<CorreiosSettings>) };

    if (!settings.usuario || !settings.senha || !settings.cartaoPostagem) {
      return { ok: false, message: "Credenciais incompletas." };
    }

    try {
      await authenticateCorreios(settings);
      return { ok: true, message: "Conexão com Correios estabelecida com sucesso!" };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Falha na conexão" };
    }
  });

// ─── Helpers internos da API Correios ─────────────────────────────────────────

function getBaseUrl(ambiente: "producao" | "homologacao") {
  return ambiente === "producao"
    ? "https://api.correios.com.br"
    : "https://apihom.correios.com.br";
}

async function authenticateCorreios(settings: CorreiosSettings): Promise<string> {
  const credentials = Buffer.from(`${settings.usuario}:${settings.senha}`).toString("base64");
  const res = await fetch(`${getBaseUrl(settings.ambiente)}/token/v1/autentica/cartaopostagem`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ numero: settings.cartaoPostagem }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Autenticação Correios falhou (${res.status}): ${text}`);
  }
  const data = await res.json() as { token?: string };
  if (!data.token) throw new Error("Token não retornado pela API dos Correios");
  return data.token;
}

async function createPrePostagem(
  token: string,
  settings: CorreiosSettings,
  order: Order,
): Promise<string> {
  const only = (s: string) => s.replace(/\D/g, "");

  const body = {
    idLote: `BS-${Date.now()}`,
    remetente: {
      nome: settings.remetenteNome,
      cpfCnpj: only(settings.remetenteCpfCnpj),
      cep: only(settings.remetenteCep),
      logradouro: settings.remetenteLogradouro,
      numero: settings.remetenteNumero,
      bairro: settings.remetenteBairro,
      cidade: settings.remetenteCidade,
      uf: settings.remetenteUf,
      email: settings.remetenteEmail,
    },
    itens: [
      {
        codigoServico: settings.codigoServico,
        destinatario: {
          nome: order.customer_name,
          cpfCnpj: only(order.customer_cpf ?? ""),
          cep: only(order.shipping_cep ?? ""),
          logradouro: order.shipping_street ?? "",
          numero: order.shipping_number ?? "",
          complemento: order.shipping_complement ?? "",
          bairro: order.shipping_neighborhood ?? "",
          cidade: order.shipping_city ?? "",
          uf: order.shipping_state ?? "",
          email: order.customer_email,
        },
        objeto: {
          tipo: "2", // caixa / embrulho
          peso: String(settings.pesoGramas),
          comprimento: String(settings.comprimentoCm),
          altura: String(settings.alturaCm),
          largura: String(settings.larguraCm),
          diametro: "0",
        },
        notaFiscal: "",
        observacao: `Pedido ${order.order_number}`,
        servicosAdicionais: [],
      },
    ],
  };

  const res = await fetch(`${getBaseUrl(settings.ambiente)}/preatendimento/v1/pre-postagens`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Erro ao criar pré-postagem (${res.status}): ${text}`);
  }

  const data = await res.json() as { itens?: { etiqueta?: string }[] };
  const etiqueta = data.itens?.[0]?.etiqueta;
  if (!etiqueta) throw new Error("Etiqueta (código de rastreio) não retornada pela API");
  return etiqueta;
}

async function fetchLabelPdf(
  token: string,
  settings: CorreiosSettings,
  etiqueta: string,
): Promise<string> {
  try {
    const res = await fetch(
      `${getBaseUrl(settings.ambiente)}/preatendimento/v1/pre-postagens/etiquetas/${etiqueta}/pdf`,
      { headers: { "Authorization": `Bearer ${token}` } },
    );
    if (!res.ok) return "";
    const buffer = await res.arrayBuffer();
    return `data:application/pdf;base64,${Buffer.from(buffer).toString("base64")}`;
  } catch {
    return ""; // PDF é best-effort — o tracking code já foi obtido
  }
}

// ─── Função principal ─────────────────────────────────────────────────────────

export type CorreiosLabelResult = {
  trackingCode: string;
  /** data:application/pdf;base64,... — vazio se PDF indisponível */
  labelPdfBase64: string;
};

export const generateCorreiosLabel = createServerFn()
  .inputValidator((input: unknown) => z.string().parse(input)) // orderId
  .handler(async ({ data: orderId }): Promise<CorreiosLabelResult> => {
    const db = createSupabaseAdmin();

    // 1. Carregar pedido
    const { data: orderRow, error: orderErr } = await db
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();
    if (orderErr || !orderRow) throw new Error("Pedido não encontrado");
    const order = orderRow as Order;

    if (!order.shipping_cep) {
      throw new Error("Pedido sem endereço de entrega — preencha os dados antes de gerar a etiqueta.");
    }

    // 2. Carregar configurações Correios
    const { data: cfgRow } = await db
      .from("store_settings")
      .select("value")
      .eq("key", "correios_settings")
      .single();

    if (!cfgRow?.value) {
      throw new Error("Correios não configurado. Acesse Configurações → Correios.");
    }
    const settings = { ...DEFAULT_CORREIOS, ...(cfgRow.value as Partial<CorreiosSettings>) };

    if (!settings.usuario || !settings.senha || !settings.cartaoPostagem) {
      throw new Error("Credenciais Correios incompletas. Configure em Configurações → Correios.");
    }
    if (!settings.remetenteNome || !settings.remetenteCep) {
      throw new Error("Dados do remetente incompletos. Configure em Configurações → Correios.");
    }

    // 3. Autenticar
    const token = await authenticateCorreios(settings);

    // 4. Criar pré-postagem → código de rastreio
    const etiqueta = await createPrePostagem(token, settings, order);

    // 5. Baixar PDF (best-effort)
    const labelPdfBase64 = await fetchLabelPdf(token, settings, etiqueta);

    // 6. Persistir código de rastreio + mudar status para "enviado"
    await db
      .from("orders")
      .update({
        tracking_code: etiqueta,
        status: "shipped",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    return { trackingCode: etiqueta, labelPdfBase64 };
  });

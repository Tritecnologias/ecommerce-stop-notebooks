import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { QrCode, CreditCard, FileText, Loader2, Copy, Check, ExternalLink, Tag, X, Truck, MapPin, Zap, FlaskConical } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCart, formatBRL } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { STORE } from "@/lib/store";
import { getStoreSettings, getTestMode } from "@/fns/settings";
import { createOrder, markOrderPaid } from "@/fns/orders";
import { initiatePayment } from "@/fns/payment";
import { validateCoupon } from "@/fns/coupons";
import { getShippingRate, calcShippingCost } from "@/lib/shipping";
import { toast } from "sonner";
import type { PaymentResult } from "@/lib/types";
import type { CouponResult } from "@/fns/coupons";

type CepAddress = {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
};

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — Secret Desire" }] }),
  component: Checkout,
});

type PayMethod = "pix" | "credit_card" | "boleto" | "test_pix";

const schema = z.object({
  customer_name: z.string().min(2, "Nome obrigatório"),
  customer_email: z.string().email("E-mail inválido"),
  customer_phone: z.string().min(10, "Telefone obrigatório"),
  customer_cpf: z.string().min(11, "CPF obrigatório"),
  shipping_cep: z.string().min(8, "CEP obrigatório"),
  shipping_street: z.string().min(1, "Endereço obrigatório"),
  shipping_number: z.string().min(1, "Número obrigatório"),
  shipping_complement: z.string().optional(),
  shipping_neighborhood: z.string().min(1, "Bairro obrigatório"),
  shipping_city: z.string().min(1, "Cidade obrigatória"),
  shipping_state: z.string().min(2, "Estado obrigatório"),
});

type FormData = z.infer<typeof schema>;

function Checkout() {
  const { detailed, subtotal, clear } = useCart();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { data: storeSettings } = useQuery({
    queryKey: ["store-settings"],
    queryFn: () => getStoreSettings(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: testMode } = useQuery({
    queryKey: ["test-mode"],
    queryFn: () => getTestMode(),
    staleTime: 60 * 1000,
    throwOnError: false,   // falha silenciosa — checkout funciona sem test mode
    retry: false,
  });

  const isTestModeOn = testMode?.pix_enabled === true;
  const enabledMethods = storeSettings?.payment_methods ?? ["pix", "credit_card", "boleto"];

  const [paymentMethod, setPaymentMethod] = useState<PayMethod>("pix");

  // Auto-seleciona se o método atual for desativado
  useEffect(() => {
    if (!enabledMethods.includes(paymentMethod) && paymentMethod !== "test_pix") {
      const first = enabledMethods[0];
      if (first) setPaymentMethod(first as PayMethod);
    }
  }, [enabledMethods, paymentMethod]);

  // Quando o modo de teste ativa, troca automaticamente para test_pix
  useEffect(() => {
    if (isTestModeOn) setPaymentMethod("test_pix");
    else if (paymentMethod === "test_pix") setPaymentMethod("pix");
  }, [isTestModeOn]); // eslint-disable-line react-hooks/exhaustive-deps
  const [loading, setLoading] = useState(false);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [copied, setCopied] = useState(false);

  // ── Cupom ────────────────────────────────────────────────────────────────
  const [couponInput, setCouponInput] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<CouponResult | null>(null);

  // ── Frete dinâmico ───────────────────────────────────────────────────────
  const [cepLookup, setCepLookup] = useState<CepAddress | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      customer_name: profile?.name ?? "",
      customer_email: user?.email ?? "",
      customer_phone: profile?.phone ?? "",
      customer_cpf: profile?.cpf ?? "",
    },
  });

  const cepValue = watch("shipping_cep");

  useEffect(() => {
    const clean = (cepValue ?? "").replace(/\D/g, "");
    if (clean.length < 8) {
      setCepLookup(null);
      setCepError(null);
      return;
    }
    let cancelled = false;
    setCepLoading(true);
    setCepError(null);
    fetch(`https://viacep.com.br/ws/${clean}/json/`)
      .then((res) => {
        if (!res.ok) throw new Error("CEP não encontrado.");
        return res.json() as Promise<{ erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string }>;
      })
      .then((data) => {
        if (cancelled) return;
        if (data.erro) throw new Error("CEP não encontrado.");
        const addr: CepAddress = {
          street: data.logradouro ?? "",
          neighborhood: data.bairro ?? "",
          city: data.localidade ?? "",
          state: data.uf ?? "",
        };
        if (addr.street) setValue("shipping_street", addr.street);
        if (addr.neighborhood) setValue("shipping_neighborhood", addr.neighborhood);
        if (addr.city) setValue("shipping_city", addr.city);
        if (addr.state) setValue("shipping_state", addr.state);
        setCepLookup(addr);
      })
      .catch((err) => {
        if (cancelled) return;
        setCepError(err instanceof Error ? err.message : "CEP não encontrado");
        setCepLookup(null);
      })
      .finally(() => { if (!cancelled) setCepLoading(false); });
    return () => { cancelled = true; };
  }, [cepValue]); // setValue é estável — não precisa entrar nas deps

  // Frete: usa tarifa regional quando CEP foi resolvido, caso contrário tarifa padrão
  const shippingRate = cepLookup ? getShippingRate(cepLookup.state) : null;
  const shippingPrice = cepLookup
    ? calcShippingCost(cepLookup.state, subtotal, STORE.shipping.freeFrom)
    : subtotal >= STORE.shipping.freeFrom || subtotal === 0
      ? 0
      : STORE.shipping.flatRate;

  const discount = appliedCoupon?.discount ?? 0;
  const total = Math.max(0, subtotal + shippingPrice - discount);

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponLoading(true);
    setCouponError(null);
    try {
      const result = await validateCoupon({ data: { code, orderTotal: subtotal + shippingPrice } });
      setAppliedCoupon(result);
      toast.success(`Cupom "${result.code}" aplicado! −${formatBRL(result.discount)}`);
    } catch (err) {
      setCouponError(err instanceof Error ? err.message : "Cupom inválido");
      setAppliedCoupon(null);
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError(null);
  };

  if (detailed.length === 0 && !paymentResult) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-bold">Seu carrinho está vazio</h1>
        <p className="mt-2 text-sm text-muted-foreground">Adicione produtos para continuar.</p>
        <Link to="/" className="mt-6 inline-block rounded-md bg-neon px-6 py-2.5 text-sm font-bold text-primary-foreground glow">
          Voltar à loja
        </Link>
      </div>
    );
  }

  if (paymentResult) {
    return <PaymentPanel result={paymentResult} copied={copied} onCopy={() => {
      navigator.clipboard.writeText(paymentResult.qrCode ?? paymentResult.barcode ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }} />;
  }

  const onSubmit = async (values: FormData) => {
    setLoading(true);
    try {
      // Se modo de teste ativo, sempre usa test_pix independente do método selecionado
      const effectiveMethod: PayMethod = isTestModeOn ? "test_pix" : paymentMethod;
      // Para test_pix, enviamos "pix" como payment_method real no banco
      const serverPaymentMethod = effectiveMethod === "test_pix" ? "pix" : effectiveMethod;

      const order = await createOrder({
        data: {
          ...values,
          user_id: user?.id,
          payment_method: serverPaymentMethod,
          coupon_code: appliedCoupon?.code,
          items: detailed.map(({ item, product }) => ({
            product_id: product.id,
            product_name: product.name,
            product_slug: product.slug,
            product_image: product.images[0],
            size: item.size,
            quantity: item.quantity,
            unit_price: product.price,
          })),
        },
      });

      // ── Modo de Teste: confirma pagamento imediatamente ──────────────────
      if (effectiveMethod === "test_pix") {
        await markOrderPaid({ data: order.id });
        clear();
        window.location.href = `/sucesso?id=${order.id}`;
        return;
      }

      const result = await initiatePayment({ data: order.id });

      if (result.redirectUrl) {
        clear();
        window.location.href = result.redirectUrl;
        return;
      }

      clear();
      setPaymentResult(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao processar pagamento";
      // Detecta erros de gateway (não configurado ou credenciais inválidas)
      const isGatewayError =
        msg.toLowerCase().includes("não configurado") ||
        msg.toLowerCase().includes("fetch failed") ||
        msg.toLowerCase().includes("access_token") ||
        msg.toLowerCase().includes("unauthorized") ||
        msg.toLowerCase().includes("401");
      if (isGatewayError) {
        toast.error("Gateway de pagamento não configurado ou inválido.", {
          description: isTestModeOn
            ? "Selecione '⚡ PIX de Teste' na seção de pagamento e tente novamente."
            : "Ative o PIX de Teste em Admin → Configurações para testar sem gateway.",
          duration: 10000,
        });
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
      <h1 className="font-display text-3xl font-bold">Checkout</h1>
      <p className="mt-1 text-sm text-muted-foreground">Finalize seu pedido em uma única página.</p>

      {/* Banner de Modo de Teste */}
      {isTestModeOn && (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
          <FlaskConical className="h-4 w-4 flex-none" />
          <span>
            <strong>Modo de Teste ativo</strong> — A opção "PIX de Teste" cria um pedido real e confirma o pagamento automaticamente, sem gateway.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {/* Dados */}
          <Section step="1" title="Dados pessoais">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Nome completo *" error={errors.customer_name?.message}>
                <input {...register("customer_name")} className={inputCls} />
              </Field>
              <Field label="E-mail *" error={errors.customer_email?.message}>
                <input {...register("customer_email")} type="email" className={inputCls} />
              </Field>
              <Field label="Telefone *" error={errors.customer_phone?.message}>
                <input {...register("customer_phone")} placeholder="(11) 99999-9999" className={inputCls} />
              </Field>
              <Field label="CPF *" error={errors.customer_cpf?.message}>
                <input {...register("customer_cpf")} placeholder="000.000.000-00" className={inputCls} />
              </Field>
            </div>
          </Section>

          {/* Entrega */}
          <Section step="2" title="Entrega">
            <div className="grid gap-3 md:grid-cols-[180px_1fr]">
              {/* CEP com indicador de status */}
              <Field label="CEP *" error={errors.shipping_cep?.message ?? cepError ?? undefined}>
                <div className="relative">
                  <input
                    {...register("shipping_cep")}
                    placeholder="00000-000"
                    maxLength={9}
                    className={inputCls + " pr-10"}
                  />
                  {cepLoading && (
                    <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                  )}
                  {cepLookup && !cepLoading && (
                    <MapPin className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neon" />
                  )}
                </div>
              </Field>

              <Field label="Endereço *" error={errors.shipping_street?.message}>
                <input {...register("shipping_street")} className={inputCls} />
              </Field>
              <Field label="Número *" error={errors.shipping_number?.message}>
                <input {...register("shipping_number")} className={inputCls} />
              </Field>
              <Field label="Complemento">
                <input {...register("shipping_complement")} placeholder="Apto, bloco…" className={inputCls} />
              </Field>
              <Field label="Bairro *" error={errors.shipping_neighborhood?.message}>
                <input {...register("shipping_neighborhood")} className={inputCls} />
              </Field>
              <Field label="Cidade *" error={errors.shipping_city?.message}>
                <input {...register("shipping_city")} className={inputCls} />
              </Field>
              <Field label="Estado *" error={errors.shipping_state?.message}>
                <input {...register("shipping_state")} placeholder="SP" maxLength={2} className={inputCls} />
              </Field>
            </div>

            {/* Cotação de frete */}
            {cepLoading && (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Calculando frete para seu CEP…
              </div>
            )}
            {cepLookup && !cepLoading && shippingRate && (
              <div className="mt-4 flex items-center justify-between rounded-md border border-border bg-secondary/40 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Truck className="h-4 w-4 flex-none text-neon" />
                  <div>
                    <p className="text-sm font-medium">Entrega via Correios</p>
                    <p className="text-xs text-muted-foreground">
                      {shippingRate.region} · até {shippingRate.days} {shippingRate.days === 1 ? "dia útil" : "dias úteis"}
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-bold ${shippingPrice === 0 ? "text-neon" : "text-foreground"}`}>
                  {shippingPrice === 0 ? "Grátis" : formatBRL(shippingPrice)}
                </span>
              </div>
            )}
            {shippingPrice === 0 && subtotal > 0 && !cepLoading && (
              <p className="mt-2 text-xs text-neon">
                Frete grátis para pedidos acima de {formatBRL(STORE.shipping.freeFrom)} ✓
              </p>
            )}
          </Section>

          {/* Pagamento */}
          <Section step="3" title="Forma de pagamento">
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${enabledMethods.length}, 1fr)` }}>
              {([
                { id: "pix" as PayMethod, label: "Pix", icon: QrCode },
                { id: "credit_card" as PayMethod, label: "Cartão", icon: CreditCard },
                { id: "boleto" as PayMethod, label: "Boleto", icon: FileText },
              ]).filter(({ id }) => enabledMethods.includes(id)).map(({ id, label, icon: Icon }) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => setPaymentMethod(id)}
                  className={`flex items-center justify-center gap-2 rounded-md border px-3 py-3 text-sm font-semibold transition ${
                    paymentMethod === id ? "border-neon bg-neon/10 text-neon" : "border-border hover:border-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>

            {/* Botão PIX de Teste — só aparece quando modo de teste está ativo */}
            {isTestModeOn && (
              <button
                type="button"
                onClick={() => setPaymentMethod("test_pix")}
                className={`mt-2 flex w-full items-center justify-center gap-2 rounded-md border px-3 py-3 text-sm font-semibold transition ${
                  paymentMethod === "test_pix"
                    ? "border-yellow-500 bg-yellow-500/10 text-yellow-400"
                    : "border-yellow-500/30 text-yellow-500/70 hover:border-yellow-500/60 hover:text-yellow-400"
                }`}
              >
                <Zap className="h-4 w-4" /> PIX de Teste
                <span className="ml-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                  MODO TESTE
                </span>
              </button>
            )}

            {enabledMethods.length > 0 && (
              <div className="mt-4 rounded-md border border-border bg-background/30 px-4 py-3 text-sm text-muted-foreground">
                {paymentMethod === "pix" && "QR Code gerado ao confirmar. Válido por 30 minutos."}
                {paymentMethod === "credit_card" && "Você será redirecionado para o checkout seguro do gateway de pagamento."}
                {paymentMethod === "boleto" && "Boleto gerado ao confirmar. Prazo de vencimento: 3 dias úteis."}
                {paymentMethod === "test_pix" && (
                  <span className="text-yellow-400">
                    ⚡ O pedido será criado e o pagamento confirmado automaticamente. Nenhum gateway é acionado.
                  </span>
                )}
              </div>
            )}
          </Section>
        </div>

        {/* Resumo */}
        <aside className="h-fit rounded-lg border border-border bg-card p-5 lg:sticky lg:top-20">
          <h3 className="font-display text-lg font-bold">Resumo do pedido</h3>
          <ul className="mt-4 space-y-3 border-b border-border pb-4">
            {detailed.map(({ item, product, lineTotal }) => (
              <li key={`${item.slug}-${item.size}`} className="flex gap-3 text-sm">
                <img src={product.images[0]} alt="" className="h-14 w-14 flex-none rounded-md object-cover" />
                <div className="flex-1">
                  <p className="font-semibold leading-tight">{product.name}</p>
                  <p className="text-xs text-muted-foreground">{item.size} · {item.quantity}x</p>
                </div>
                <p className="text-sm font-semibold">{formatBRL(lineTotal)}</p>
              </li>
            ))}
          </ul>

          {/* Cupom de desconto */}
          <div className="mt-4 border-t border-border pt-4">
            {appliedCoupon ? (
              <div className="flex items-center justify-between rounded-md border border-neon/40 bg-neon/10 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5 text-neon flex-none" />
                  <div>
                    <p className="text-xs font-bold text-neon leading-tight">{appliedCoupon.code}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {appliedCoupon.type === "percent"
                        ? `${appliedCoupon.value}% de desconto`
                        : `${formatBRL(appliedCoupon.value)} de desconto`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={removeCoupon}
                  title="Remover cupom"
                  className="flex h-6 w-6 items-center justify-center rounded hover:text-destructive transition-colors text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Tag className="h-3 w-3" /> Cupom de desconto
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => {
                      setCouponInput(e.target.value.toUpperCase());
                      setCouponError(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), applyCoupon())}
                    placeholder="SEU CÓDIGO"
                    className="h-9 flex-1 rounded-md border border-border bg-secondary/50 px-3 font-mono text-xs uppercase placeholder:text-muted-foreground focus:border-neon focus:outline-none focus:ring-1 focus:ring-neon transition"
                  />
                  <button
                    type="button"
                    onClick={applyCoupon}
                    disabled={couponLoading || !couponInput.trim()}
                    className="h-9 rounded-md border border-border bg-secondary px-3 text-xs font-semibold hover:border-neon hover:text-neon disabled:opacity-40 transition flex items-center gap-1.5"
                  >
                    {couponLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Aplicar"}
                  </button>
                </div>
                {couponError && (
                  <p className="mt-1.5 text-xs text-destructive">{couponError}</p>
                )}
              </div>
            )}
          </div>

          {/* Totais */}
          <div className="mt-4 space-y-2 text-sm">
            <Row label="Subtotal" value={formatBRL(subtotal)} />

            {/* Frete com prazo estimado */}
            <div className="flex items-start justify-between text-muted-foreground">
              <span>Frete</span>
              <div className="text-right">
                {cepLoading ? (
                  <span className="flex items-center gap-1 text-xs">
                    <Loader2 className="h-3 w-3 animate-spin" /> Calculando…
                  </span>
                ) : (
                  <>
                    <span className={shippingPrice === 0 ? "font-semibold text-neon" : "text-foreground"}>
                      {shippingPrice === 0 ? "Grátis" : formatBRL(shippingPrice)}
                    </span>
                    {shippingRate && (
                      <p className="text-[11px] text-muted-foreground">
                        até {shippingRate.days} {shippingRate.days === 1 ? "dia útil" : "dias úteis"}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            {appliedCoupon && (
              <Row
                label={`Cupom (${appliedCoupon.code})`}
                value={<span className="font-semibold text-neon">−{formatBRL(appliedCoupon.discount)}</span>}
              />
            )}
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <span className="font-semibold">Total</span>
              <span className="font-display text-xl font-bold text-neon neon-text">{formatBRL(total)}</span>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-neon py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-transform hover:scale-[1.01] disabled:opacity-70 glow"
          >
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Processando…</> : "Concluir pagamento"}
          </button>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">Pagamento 100% seguro · SSL</p>
        </aside>
      </form>
    </div>
  );
}

function PaymentPanel({ result, copied, onCopy }: { result: PaymentResult; copied: boolean; onCopy: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="font-display text-3xl font-bold">
        {result.paymentMethod === "pix" ? "Pague com Pix" :
         result.paymentMethod === "boleto" ? "Boleto gerado" :
         "Redirecionando…"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Pedido <span className="text-neon font-bold">#{result.orderNumber}</span>
      </p>

      {result.paymentMethod === "pix" && (
        <div className="mt-8 rounded-lg border border-border bg-card p-6">
          {result.qrCodeBase64 ? (
            <img
              src={`data:image/png;base64,${result.qrCodeBase64}`}
              alt="QR Code Pix"
              className="mx-auto h-48 w-48 rounded-md"
            />
          ) : (
            <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-md bg-foreground p-3">
              <QrCode className="h-24 w-24 text-background" />
            </div>
          )}
          {result.qrCode && (
            <>
              <p className="mt-4 text-xs text-muted-foreground">Ou copie o código Pix:</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-secondary px-3 py-2 text-[11px] text-left">{result.qrCode}</code>
                <button
                  onClick={onCopy}
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-md border border-border hover:border-neon hover:text-neon transition-colors"
                >
                  {copied ? <Check className="h-4 w-4 text-neon" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </>
          )}
          {result.expiresAt && (
            <p className="mt-4 text-xs text-muted-foreground">
              Expira em: {new Date(result.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
          <p className="mt-4 text-sm text-muted-foreground">
            Após o pagamento, seu pedido será confirmado automaticamente.
          </p>
        </div>
      )}

      {result.paymentMethod === "boleto" && (
        <div className="mt-8 rounded-lg border border-border bg-card p-6 text-left">
          {result.barcode && (
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2">Código de barras:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-secondary px-3 py-2 text-xs">{result.barcode}</code>
                <button onClick={onCopy} className="flex h-9 w-9 flex-none items-center justify-center rounded-md border border-border hover:border-neon transition-colors">
                  {copied ? <Check className="h-4 w-4 text-neon" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}
          {result.barcodeUrl && (
            <a
              href={result.barcodeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-neon px-4 py-2 text-sm font-bold text-primary-foreground glow"
            >
              <ExternalLink className="h-4 w-4" /> Visualizar boleto
            </a>
          )}
          {result.expiresAt && (
            <p className="mt-4 text-xs text-muted-foreground">
              Vencimento: {new Date(result.expiresAt).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
      )}

      <Link to="/" className="mt-8 inline-block text-sm text-neon hover:underline">
        Continuar comprando
      </Link>
    </div>
  );
}

function Section({ step, title, children }: { step: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neon text-xs font-bold text-primary-foreground">{step}</span>
        <h2 className="font-display text-lg font-bold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-destructive">{error}</span>}
    </label>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

const inputCls =
  "h-11 w-full rounded-md border border-border bg-secondary/50 px-3 text-sm placeholder:text-muted-foreground focus:border-neon focus:outline-none focus:ring-1 focus:ring-neon transition";

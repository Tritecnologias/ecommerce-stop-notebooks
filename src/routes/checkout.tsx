import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, CreditCard, QrCode, FileText, Loader2 } from "lucide-react";
import { useCart, formatBRL } from "@/lib/cart";
import { STORE } from "@/lib/store";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — BodySplashers" }] }),
  component: Checkout,
});

type PayMethod = "pix" | "card" | "boleto";

function Checkout() {
  const { detailed, subtotal, clear } = useCart();
  const navigate = useNavigate();
  const [payment, setPayment] = useState<PayMethod>("pix");
  const [loading, setLoading] = useState(false);

  const shipping = subtotal >= STORE.shipping.freeFrom || subtotal === 0 ? 0 : STORE.shipping.flatRate;
  const total = subtotal + shipping;

  if (detailed.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-bold">Seu carrinho está vazio</h1>
        <p className="mt-2 text-sm text-muted-foreground">Adicione produtos para continuar.</p>
        <Link to="/" className="mt-6 inline-block rounded-md bg-neon px-6 py-2.5 text-sm font-bold text-primary-foreground">
          Voltar à loja
        </Link>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      const orderId = Math.random().toString(36).slice(2, 10).toUpperCase();
      clear();
      navigate({ to: "/sucesso", search: { id: orderId } });
    }, 1600);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
      <h1 className="font-display text-3xl font-bold">Checkout</h1>
      <p className="mt-1 text-sm text-muted-foreground">Finalize seu pedido em uma única página.</p>

      <form onSubmit={handleSubmit} className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {/* Dados */}
          <Section step="1" title="Dados pessoais">
            <div className="grid gap-3 md:grid-cols-2">
              <Input label="Nome completo" required />
              <Input label="E-mail" type="email" required />
              <Input label="Telefone" required />
              <Input label="CPF" required />
            </div>
          </Section>

          {/* Entrega */}
          <Section step="2" title="Entrega">
            <div className="grid gap-3 md:grid-cols-[180px_1fr]">
              <Input label="CEP" required />
              <Input label="Endereço" required />
              <Input label="Número" required />
              <Input label="Complemento" />
              <Input label="Bairro" required />
              <Input label="Cidade" required />
            </div>
          </Section>

          {/* Pagamento */}
          <Section step="3" title="Pagamento">
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: "pix", label: "Pix", icon: QrCode },
                { id: "card", label: "Cartão", icon: CreditCard },
                { id: "boleto", label: "Boleto", icon: FileText },
              ] as const).map(({ id, label, icon: Icon }) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => setPayment(id)}
                  className={`flex items-center justify-center gap-2 rounded-md border px-3 py-3 text-sm font-semibold transition ${
                    payment === id ? "border-neon bg-neon/10 text-neon" : "border-border hover:border-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>

            <div className="mt-5">
              {payment === "pix" && (
                <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-background/50 p-6 text-center">
                  <div className="flex h-40 w-40 items-center justify-center rounded-md bg-foreground p-3">
                    <div className="grid h-full w-full grid-cols-8 gap-px">
                      {Array.from({ length: 64 }).map((_, i) => (
                        <div key={i} className={Math.random() > 0.5 ? "bg-background" : "bg-foreground"} />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Escaneie o QR Code ou use o código abaixo</p>
                  <code className="block w-full break-all rounded bg-secondary px-3 py-2 text-[11px]">
                    00020126580014BR.GOV.BCB.PIX0136bodysplashers@pix.com5204000053039865406{total.toFixed(2)}5802BR
                  </code>
                </div>
              )}
              {payment === "card" && (
                <div className="grid gap-3">
                  <Input label="Número do cartão" placeholder="0000 0000 0000 0000" required maxLength={19} />
                  <Input label="Nome impresso no cartão" required />
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Validade" placeholder="MM/AA" required maxLength={5} />
                    <Input label="CVV" placeholder="123" required maxLength={4} />
                  </div>
                  <select className="h-11 rounded-md border border-border bg-secondary/50 px-3 text-sm focus:border-neon focus:outline-none">
                    <option>1x de {formatBRL(total)} sem juros</option>
                    <option>3x de {formatBRL(total / 3)} sem juros</option>
                    <option>6x de {formatBRL(total / 6)} sem juros</option>
                  </select>
                </div>
              )}
              {payment === "boleto" && (
                <div className="rounded-md border border-border bg-background/50 p-5 text-sm text-muted-foreground">
                  <p>O boleto será gerado após a finalização. Prazo de compensação: 1 a 2 dias úteis.</p>
                </div>
              )}
            </div>
          </Section>
        </div>

        {/* Resumo */}
        <aside className="h-fit rounded-lg border border-border bg-card p-5 lg:sticky lg:top-20">
          <h3 className="font-display text-lg font-bold">Resumo do pedido</h3>
          <ul className="mt-4 space-y-3 border-b border-border pb-4">
            {detailed.map(({ item, product, lineTotal }) => (
              <li key={`${item.productId}-${item.size}`} className="flex gap-3 text-sm">
                <img src={product.images[0]} alt="" className="h-14 w-14 flex-none rounded-md object-cover" />
                <div className="flex-1">
                  <p className="font-semibold leading-tight">{product.name}</p>
                  <p className="text-xs text-muted-foreground">{item.size} · {item.quantity}x</p>
                </div>
                <p className="text-sm font-semibold">{formatBRL(lineTotal)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-2 text-sm">
            <Row label="Subtotal" value={formatBRL(subtotal)} />
            <Row label="Frete" value={shipping === 0 ? <span className="text-neon">Grátis</span> : formatBRL(shipping)} />
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
          <p className="mt-3 text-center text-[11px] text-muted-foreground">Pagamento 100% seguro</p>
        </aside>
      </form>
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

function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}{props.required && " *"}</span>
      <input
        {...props}
        className="h-11 w-full rounded-md border border-border bg-secondary/50 px-3 text-sm placeholder:text-muted-foreground focus:border-neon focus:outline-none focus:ring-1 focus:ring-neon transition"
      />
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

// silence unused
void Check;

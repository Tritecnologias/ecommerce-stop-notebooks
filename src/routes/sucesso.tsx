import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Mail, Package, Loader2 } from "lucide-react";
import { getOrderById } from "@/fns/orders";
import { formatBRL } from "@/lib/cart";

type Search = { id?: string };

export const Route = createFileRoute("/sucesso")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    id: typeof s.id === "string" ? s.id : undefined,
  }),
  head: () => ({ meta: [{ title: "Pedido confirmado — Secret Desire" }] }),
  component: Success,
});

function Success() {
  const { id } = Route.useSearch();

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => (id ? getOrderById({ data: id }) : null),
    enabled: !!id,
  });

  const orderNumber = order?.order_number ?? id?.slice(0, 12).toUpperCase() ?? "—";

  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-neon glow-strong animate-check-pop">
        <Check className="h-10 w-10 text-primary-foreground" strokeWidth={3} />
      </div>

      <h1 className="mt-8 font-display text-3xl font-bold md:text-4xl">Pedido confirmado!</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Obrigado pela compra. Você receberá os detalhes por e-mail.
      </p>

      <div className="mt-8 rounded-lg border border-border bg-card p-6 text-left">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-neon" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Número do pedido</span>
              <span className="font-display text-lg font-bold text-neon">#{orderNumber}</span>
            </div>

            {order && (
              <div className="mt-4 border-t border-border pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-bold text-neon">{formatBRL(order.total)}</span>
                </div>
                {order.shipping_city && (
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span className="text-muted-foreground">Entrega</span>
                    <span className="text-xs">{order.shipping_city}/{order.shipping_state}</span>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 space-y-4 border-t border-border pt-6 text-sm">
              <div className="flex gap-3">
                <Mail className="h-5 w-5 flex-none text-neon" />
                <div>
                  <p className="font-semibold">Confirmação enviada</p>
                  <p className="text-xs text-muted-foreground">Verifique sua caixa de entrada.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Package className="h-5 w-5 flex-none text-neon" />
                <div>
                  <p className="font-semibold">Rastreio em até 2 dias úteis</p>
                  <p className="text-xs text-muted-foreground">Enviaremos o código assim que o pedido for despachado.</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        <Link
          to="/conta/pedidos"
          className="inline-block rounded-md border border-neon px-6 py-2.5 text-sm font-bold text-neon hover:bg-neon/10 transition-colors"
        >
          Ver meus pedidos
        </Link>
        <Link
          to="/"
          className="rounded-md bg-neon px-8 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground glow transition-transform hover:scale-[1.02]"
        >
          Continuar comprando
        </Link>
      </div>
    </div>
  );
}

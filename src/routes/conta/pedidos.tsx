import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Package, User, ExternalLink, CheckCircle2, XCircle, Truck, ShoppingBag, Banknote, Archive, RotateCcw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getUserOrders } from "@/fns/orders";
import { formatBRL, useCart } from "@/lib/cart";
import { toast } from "sonner";
import type { Order } from "@/lib/types";

export const Route = createFileRoute("/conta/pedidos")({
  head: () => ({ meta: [{ title: "Meus pedidos — Secret Desire" }] }),
  component: Orders,
});

const statusLabel: Record<string, string> = {
  pending: "Aguardando pagamento",
  confirmed: "Confirmado",
  processing: "Em preparação",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const statusColor: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  confirmed: "bg-neon/10 text-neon border-neon/30",
  processing: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  shipped: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  delivered: "bg-green-500/10 text-green-400 border-green-500/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
};

// ─── Stepper ─────────────────────────────────────────────────────────────────

type Step = {
  id: string;
  label: string;
  icon: typeof Package;
};

const STEPS: Step[] = [
  { id: "pending",    label: "Pedido realizado",   icon: ShoppingBag },
  { id: "confirmed",  label: "Pagamento confirmado", icon: Banknote },
  { id: "processing", label: "Em preparação",       icon: Archive },
  { id: "shipped",    label: "Enviado",              icon: Truck },
  { id: "delivered",  label: "Entregue",             icon: Package },
];

const STEP_INDEX: Record<string, number> = {
  pending: 0, confirmed: 1, processing: 2, shipped: 3, delivered: 4,
};

function OrderTimeline({ order }: { order: Order }) {
  if (order.status === "cancelled") {
    return (
      <div className="mt-5 flex items-center gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        <XCircle className="h-4 w-4 flex-none" />
        <span>Este pedido foi cancelado.</span>
      </div>
    );
  }

  const currentIdx = STEP_INDEX[order.status] ?? 0;

  return (
    <div className="mt-5">
      {/* Desktop horizontal stepper */}
      <div className="hidden sm:flex items-start">
        {STEPS.map((step, idx) => {
          const done = idx < currentIdx;
          const active = idx === currentIdx;
          const future = idx > currentIdx;
          const Icon = step.icon;

          return (
            <div key={step.id} className="flex flex-1 flex-col items-center">
              {/* connector + circle row */}
              <div className="flex w-full items-center">
                {/* left connector */}
                <div className={`h-0.5 flex-1 ${idx === 0 ? "invisible" : done || active ? "bg-neon" : "bg-border"}`} />

                {/* circle */}
                <div className={`relative flex h-8 w-8 flex-none items-center justify-center rounded-full border-2 transition-colors
                  ${done    ? "border-neon bg-neon text-primary-foreground"       : ""}
                  ${active  ? "border-neon bg-neon/10 text-neon"                  : ""}
                  ${future  ? "border-border bg-background text-muted-foreground" : ""}
                `}>
                  {done ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Icon className={`h-3.5 w-3.5 ${active ? "text-neon" : "text-muted-foreground"}`} />
                  )}
                  {active && (
                    <span className="absolute inset-0 rounded-full animate-ping bg-neon/20" />
                  )}
                </div>

                {/* right connector */}
                <div className={`h-0.5 flex-1 ${idx === STEPS.length - 1 ? "invisible" : done ? "bg-neon" : "bg-border"}`} />
              </div>

              {/* label */}
              <p className={`mt-2 text-center text-[10px] leading-tight font-medium px-1
                ${active ? "text-neon" : done ? "text-foreground" : "text-muted-foreground"}
              `}>
                {step.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Mobile vertical stepper */}
      <div className="flex flex-col gap-0 sm:hidden">
        {STEPS.map((step, idx) => {
          const done = idx < currentIdx;
          const active = idx === currentIdx;
          const Icon = step.icon;

          return (
            <div key={step.id} className="flex gap-3">
              {/* icon column */}
              <div className="flex flex-col items-center">
                <div className={`relative flex h-7 w-7 flex-none items-center justify-center rounded-full border-2
                  ${done   ? "border-neon bg-neon text-primary-foreground"       : ""}
                  ${active ? "border-neon bg-neon/10 text-neon"                  : ""}
                  ${!done && !active ? "border-border bg-background text-muted-foreground" : ""}
                `}>
                  {done ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <Icon className="h-3 w-3" />
                  )}
                  {active && (
                    <span className="absolute inset-0 rounded-full animate-ping bg-neon/20" />
                  )}
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`w-0.5 flex-1 min-h-[20px] my-0.5 ${done ? "bg-neon" : "bg-border"}`} />
                )}
              </div>

              {/* label */}
              <p className={`pt-1 pb-4 text-xs font-medium leading-tight
                ${active ? "text-neon" : done ? "text-foreground" : "text-muted-foreground"}
              `}>
                {step.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Tracking code */}
      {order.tracking_code && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-4 py-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Código de rastreio</p>
            <p className="font-mono font-bold text-sm text-neon">{order.tracking_code}</p>
          </div>
          <a
            href={`https://rastreamento.correios.com.br/app/index.php?objetos=${order.tracking_code}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-neon hover:underline"
          >
            Rastrear <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function Orders() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { add, open: openCart } = useCart();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["user-orders", user?.id],
    queryFn: () => getUserOrders({ data: user!.id }),
    enabled: !!user,
  });

  if (loading || isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-neon" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 md:px-6">
      <h1 className="font-display text-3xl font-bold mb-8">Meus pedidos</h1>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <nav className="space-y-1">
          <NavItem to="/conta" icon={User} label="Meus dados" />
          <NavItem to="/conta/pedidos" icon={Package} label="Meus pedidos" active />
        </nav>

        <div>
          {!orders || orders.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-12 text-center">
              <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="font-display text-xl font-bold">Nenhum pedido ainda</h2>
              <p className="mt-2 text-sm text-muted-foreground">Seus pedidos aparecerão aqui.</p>
              <Link to="/" className="mt-6 inline-block rounded-md bg-neon px-6 py-2.5 text-sm font-bold text-primary-foreground glow">
                Ir às compras
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div key={order.id} className="rounded-lg border border-border bg-card p-5">
                  {/* Header */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-display font-bold text-neon text-lg">#{order.order_number}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(order.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusColor[order.status] ?? ""}`}>
                        {statusLabel[order.status] ?? order.status}
                      </span>
                      <Link
                        to="/sucesso"
                        search={{ id: order.id }}
                        className="flex items-center gap-1 text-xs text-neon hover:underline"
                      >
                        Detalhes <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>

                  {/* Timeline */}
                  <OrderTimeline order={order} />

                  {/* Items */}
                  {order.order_items && order.order_items.length > 0 && (
                    <div className="mt-5 flex flex-wrap gap-3 border-t border-border pt-4">
                      {order.order_items.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 text-sm">
                          {item.product_image && (
                            <img src={item.product_image} alt="" className="h-10 w-10 rounded-md object-cover border border-border" />
                          )}
                          <div>
                            <p className="font-medium text-xs">{item.product_name}</p>
                            <p className="text-xs text-muted-foreground">{item.size} · {item.quantity}×</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Footer: total + comprar novamente */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                    <span className="text-sm text-muted-foreground">
                      Total: <span className="font-bold text-neon">{formatBRL(order.total)}</span>
                    </span>
                    {order.order_items && order.order_items.length > 0 && (
                      <button
                        onClick={() => {
                          if (!order.order_items) return;
                          let added = 0;
                          for (const item of order.order_items) {
                            if (item.product_slug) {
                              add(item.product_slug, item.size, item.quantity);
                              added++;
                            }
                          }
                          if (added > 0) {
                            toast.success(`${added} ${added === 1 ? "item adicionado" : "itens adicionados"} ao carrinho!`);
                            openCart();
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:border-neon hover:text-neon"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Comprar novamente
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NavItem({ to, icon: Icon, label, active }: { to: string; icon: typeof User; label: string; active?: boolean }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
        active ? "bg-neon/10 text-neon" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

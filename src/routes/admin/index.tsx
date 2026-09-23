import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from "recharts";
import {
  Package, ShoppingBag, DollarSign, Clock, LayoutDashboard, PackageSearch,
  ChevronRight, Tag, Settings, Users, AlertTriangle, Image, Home, Star,
  BarChart2, TrendingUp, TrendingDown, Minus, Award, ReceiptText, Palette,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useOrderNotif } from "@/lib/order-notifications";
import { getAdminOrders } from "@/fns/orders";
import { getAdminProducts } from "@/fns/products";
import { getDashboardStats } from "@/fns/analytics";
import { getActiveLogos } from "@/fns/logos";
import { formatBRL } from "@/lib/cart";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin Dashboard — Secret Desire" }] }),
  component: AdminDashboard,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function Trend({ current, previous }: { current: number; previous: number }) {
  const pct = pctChange(current, previous);
  if (pct === null) return <span className="text-xs text-muted-foreground">—</span>;
  const up = pct >= 0;
  const Icon = pct === 0 ? Minus : up ? TrendingUp : TrendingDown;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-semibold ${up ? "text-green-400" : "text-destructive"}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando",
  confirmed: "Confirmado",
  processing: "Preparando",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "text-yellow-400",
  confirmed: "text-neon",
  processing: "text-blue-400",
  shipped: "text-purple-400",
  delivered: "text-green-400",
  cancelled: "text-destructive",
};
const STATUS_BAR_COLOR: Record<string, string> = {
  pending: "bg-yellow-400",
  confirmed: "bg-neon",
  processing: "bg-blue-400",
  shipped: "bg-purple-400",
  delivered: "bg-green-400",
  cancelled: "bg-destructive",
};

// ─── Componente ───────────────────────────────────────────────────────────────

function AdminDashboard() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [chartPeriod, setChartPeriod] = useState<"7" | "30">("7");

  useEffect(() => {
    if (!loading) {
      if (!user) navigate({ to: "/login" });
      else if (profile && profile.role !== "admin") navigate({ to: "/" });
    }
  }, [user, profile, loading, navigate]);

  // Últimos 8 pedidos para a tabela
  const { data: ordersData } = useQuery({
    queryKey: ["admin-orders-dashboard"],
    queryFn: () => getAdminOrders({ data: { page: 1, limit: 8 } }),
    enabled: !!user && profile?.role === "admin",
  });

  // Produtos para alerta de estoque
  const { data: products } = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => getAdminProducts(),
    enabled: !!user && profile?.role === "admin",
    staleTime: 2 * 60 * 1000,
  });

  // Stats analytics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => getDashboardStats(),
    enabled: !!user && profile?.role === "admin",
    staleTime: 3 * 60 * 1000,
  });

  const criticalStock = (products ?? []).filter((p) => p.active && p.stock < 5);
  const recentOrders = ordersData?.orders ?? [];
  const chartData = stats
    ? (chartPeriod === "7" ? stats.revenueByDay7 : stats.revenueByDay)
    : [];

  if (loading || !profile) return null;

  return (
    <AdminLayout title="Dashboard">
      {/* ── Alerta estoque crítico ─────────────────────────────────────── */}
      {criticalStock.length > 0 && (
        <Link
          to="/admin/produtos"
          className="mb-5 flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive hover:bg-destructive/15 transition-colors"
        >
          <AlertTriangle className="h-4 w-4 flex-none" />
          <span>
            <strong>{criticalStock.length} produto{criticalStock.length !== 1 ? "s" : ""}</strong>{" "}
            com estoque crítico (abaixo de 5 un.)
            {criticalStock.length <= 3 && (
              <span className="text-destructive/80"> — {criticalStock.map((p) => p.name).join(", ")}</span>
            )}
          </span>
          <ChevronRight className="ml-auto h-4 w-4 flex-none" />
        </Link>
      )}

      {/* ── KPI cards principais ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={DollarSign}
          label="Receita este mês"
          value={formatBRL(stats?.revenueThisMonth ?? 0)}
          sub={<Trend current={stats?.revenueThisMonth ?? 0} previous={stats?.revenueLastMonth ?? 0} />}
          loading={statsLoading}
        />
        <KpiCard
          icon={ShoppingBag}
          label="Pedidos este mês"
          value={String(stats?.ordersThisMonth ?? 0)}
          sub={<Trend current={stats?.ordersThisMonth ?? 0} previous={stats?.ordersLastMonth ?? 0} />}
          loading={statsLoading}
        />
        <KpiCard
          icon={ReceiptText}
          label="Ticket médio"
          value={formatBRL(stats?.avgTicket ?? 0)}
          loading={statsLoading}
        />
        <KpiCard
          icon={Clock}
          label="Aguardando pagto"
          value={String(stats?.pendingCount ?? 0)}
          accent
          loading={statsLoading}
        />
      </div>

      {/* ── Linha 2: receita total + mês anterior ─────────────────────── */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Receita total (60 dias)</p>
          <p className="mt-1 text-xl font-bold text-neon">{formatBRL(stats?.revenueTotal ?? 0)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Mês anterior</p>
          <p className="mt-1 text-xl font-bold">{formatBRL(stats?.revenueLastMonth ?? 0)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Pedidos pagos (60 dias)</p>
          <p className="mt-1 text-xl font-bold text-green-400">{stats?.paidOrdersCount ?? 0}</p>
        </div>
      </div>

      {/* ── Gráfico de receita ─────────────────────────────────────────── */}
      <div className="mt-6 rounded-lg border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display font-bold">Receita por dia</h2>
          <div className="flex rounded-md border border-border overflow-hidden text-xs">
            {(["7", "30"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setChartPeriod(p)}
                className={`px-3 py-1.5 transition-colors ${
                  chartPeriod === p ? "bg-neon text-primary-foreground font-bold" : "text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                {p}d
              </button>
            ))}
          </div>
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            {chartPeriod === "7" ? (
              <BarChart data={chartData}>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#888" }} />
                <YAxis tick={{ fontSize: 11, fill: "#888" }} tickFormatter={(v) => `R$${v}`} width={60} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(v: number) => [formatBRL(v), "Receita"]}
                />
                <Bar dataKey="revenue" fill="oklch(0.92 0.27 142)" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#888" }} interval={4} />
                <YAxis tick={{ fontSize: 10, fill: "#888" }} tickFormatter={(v) => `R$${v}`} width={60} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(v: number) => [formatBRL(v), "Receita"]}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="oklch(0.92 0.27 142)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Linha inferior: top produtos + status breakdown ───────────── */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Top produtos */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Award className="h-4 w-4 text-neon" />
            <h2 className="font-display font-bold">Top 5 produtos (60 dias)</h2>
          </div>
          {statsLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-6 animate-pulse rounded bg-secondary/60" />
              ))}
            </div>
          ) : (stats?.topProducts ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum dado ainda.</p>
          ) : (
            <ol className="space-y-3">
              {(stats?.topProducts ?? []).map((p, i) => {
                const maxRev = stats!.topProducts[0].revenue;
                const pct = maxRev > 0 ? (p.revenue / maxRev) * 100 : 0;
                return (
                  <li key={p.product_slug} className="flex items-center gap-3">
                    <span className="w-4 flex-none text-xs font-bold text-muted-foreground">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium truncate">{p.product_name}</span>
                        <span className="ml-2 flex-none text-xs text-neon font-bold">{formatBRL(p.revenue)}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-secondary/60">
                        <div
                          className="h-full rounded-full bg-neon transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{p.quantity} und. vendidas</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* Status breakdown */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-neon" />
            <h2 className="font-display font-bold">Pedidos por status</h2>
          </div>
          {statsLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-6 animate-pulse rounded bg-secondary/60" />
              ))}
            </div>
          ) : (stats?.statusBreakdown ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pedido ainda.</p>
          ) : (
            <div className="space-y-3">
              {(() => {
                const total = (stats?.statusBreakdown ?? []).reduce((s, b) => s + b.count, 0);
                return (stats?.statusBreakdown ?? []).map((b) => {
                  const pct = total > 0 ? (b.count / total) * 100 : 0;
                  return (
                    <div key={b.status}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-semibold ${STATUS_COLOR[b.status] ?? "text-foreground"}`}>
                          {STATUS_LABEL[b.status] ?? b.status}
                        </span>
                        <span className="text-xs text-muted-foreground">{b.count} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-secondary/60">
                        <div
                          className={`h-full rounded-full transition-all ${STATUS_BAR_COLOR[b.status] ?? "bg-foreground"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      </div>

      {/* ── Pedidos recentes ──────────────────────────────────────────── */}
      <div className="mt-6 rounded-lg border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display font-bold">Pedidos recentes</h2>
          <Link to="/admin/pedidos" className="flex items-center gap-1 text-xs text-neon hover:underline">
            Ver todos <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="pb-3 pr-4">Pedido</th>
                <th className="pb-3 pr-4">Cliente</th>
                <th className="pb-3 pr-4">Total</th>
                <th className="pb-3 pr-4">Pagamento</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentOrders.map((order) => (
                <tr key={order.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="py-3 pr-4">
                    <Link to="/admin/pedidos/$id" params={{ id: order.id }} className="text-neon hover:underline font-mono text-xs">
                      #{order.order_number}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-xs">{order.customer_name}</td>
                  <td className="py-3 pr-4 font-semibold">{formatBRL(order.total)}</td>
                  <td className="py-3 pr-4">
                    <span className={`text-xs font-semibold ${order.payment_status === "paid" ? "text-green-400" : "text-yellow-400"}`}>
                      {order.payment_status === "paid" ? "Pago" : "Pendente"}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className={`text-xs font-semibold ${STATUS_COLOR[order.status] ?? ""}`}>
                      {STATUS_LABEL[order.status] ?? order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  loading,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  sub?: React.ReactNode;
  accent?: boolean;
  loading?: boolean;
}) {
  return (
    <div className={`rounded-lg border bg-card p-5 ${accent ? "border-yellow-500/40" : "border-border"}`}>
      <div className="flex items-center justify-between">
        <Icon className={`h-5 w-5 ${accent ? "text-yellow-400" : "text-neon"}`} />
        {sub && <div>{sub}</div>}
      </div>
      {loading ? (
        <div className="mt-4 h-7 w-24 animate-pulse rounded bg-secondary/60" />
      ) : (
        <p className="mt-4 font-display text-2xl font-bold">{value}</p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// ─── AdminLayout + SideLink ───────────────────────────────────────────────────

export function AdminLayout({ title, children }: { title: string; children: React.ReactNode }) {
  const { newCount } = useOrderNotif();
  const { data: products } = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => getAdminProducts(),
    staleTime: 2 * 60 * 1000,
  });
  const { data: activeLogos } = useQuery({
    queryKey: ["active-logos"],
    queryFn: () => getActiveLogos(),
    staleTime: 60 * 1000,
  });
  const adminLogo = activeLogos?.admin || activeLogos?.header;
  const criticalCount = (products ?? []).filter((p) => p.active && p.stock < 5).length;
  return (
    <div className="flex min-h-screen">
      <aside className="fixed left-0 top-0 z-30 flex h-full w-60 flex-col border-r border-border bg-background/95 pt-6">
        <div className="px-5 pb-6">
          <Link to="/" className="flex items-center gap-2">
            {adminLogo ? (
              <img
                src={adminLogo.url}
                alt={adminLogo.alt_text || "Logotipo"}
                style={{ maxHeight: `${Math.min(adminLogo.height || 32, 36)}px` }}
                className="object-contain"
              />
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-neon glow" />
                <span className="font-display text-sm font-bold">Secret Desire</span>
              </>
            )}
          </Link>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">Admin</p>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          <SideLink to="/admin" icon={LayoutDashboard} label="Dashboard" />
          <SideLink to="/admin/home" icon={Home} label="Página Inicial" />
          <SideLink to="/admin/produtos" icon={PackageSearch} label="Produtos" badge={criticalCount || undefined} />
          <SideLink to="/admin/pedidos" icon={Package} label="Pedidos" badge={newCount} />
          <SideLink to="/admin/clientes" icon={Users} label="Clientes" />
          <SideLink to="/admin/cupons" icon={Tag} label="Cupons" />
          <SideLink to="/admin/avaliacoes" icon={Star} label="Avaliações" />
          <SideLink to="/admin/relatorio" icon={BarChart2} label="Relatório" />
          <SideLink to="/admin/banners" icon={Image} label="Banners" />
          <SideLink to="/admin/logotipos" icon={Palette} label="Logotipos" />
          <SideLink to="/admin/configuracoes" icon={Settings} label="Configurações" />
        </nav>
        <div className="border-t border-border px-5 py-4">
          <Link to="/conta" className="text-xs text-muted-foreground hover:text-foreground">← Sair do admin</Link>
        </div>
      </aside>

      <main className="ml-60 flex-1 px-6 py-8">
        <h1 className="font-display text-2xl font-bold mb-6">{title}</h1>
        {children}
      </main>
    </div>
  );
}

function SideLink({ to, icon: Icon, label, badge }: { to: string; icon: typeof Package; label: string; badge?: number }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/admin" }}
      className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground [&.active]:bg-neon/10 [&.active]:text-neon"
    >
      <Icon className="h-4 w-4 flex-none" />
      <span className="flex-1">{label}</span>
      {!!badge && badge > 0 && (
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-yellow-500 px-1.5 text-[10px] font-bold text-black animate-pulse">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

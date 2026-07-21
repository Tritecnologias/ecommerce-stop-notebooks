import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, CartesianGrid,
} from "recharts";
import {
  DollarSign, ShoppingBag, TrendingUp, TrendingDown,
  Users, Package, BarChart2, Calendar, Loader2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getSalesReport } from "@/fns/reports";
import { formatBRL } from "@/lib/cart";
import { AdminLayout } from "@/routes/admin/index";

export const Route = createFileRoute("/admin/relatorio/")({
  head: () => ({ meta: [{ title: "Relatório de Vendas — Admin Secret Desire" }] }),
  component: AdminReport,
});

// ─── Utilitários de data ──────────────────────────────────────────────────────
function toISO(d: Date) { return d.toISOString().slice(0, 10); }

function getPreset(preset: string): { start: string; end: string } {
  const now = new Date();
  const today = toISO(now);

  if (preset === "today") {
    return { start: today, end: today };
  }
  if (preset === "yesterday") {
    const d = new Date(now); d.setDate(d.getDate() - 1);
    const s = toISO(d);
    return { start: s, end: s };
  }
  if (preset === "week") {
    const d = new Date(now); d.setDate(d.getDate() - 6);
    return { start: toISO(d), end: today };
  }
  if (preset === "month") {
    const d = new Date(now); d.setDate(d.getDate() - 29);
    return { start: toISO(d), end: today };
  }
  if (preset === "thismonth") {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: toISO(d), end: today };
  }
  return { start: today, end: today };
}

// ─── Delta (variação percentual) ─────────────────────────────────────────────
function Delta({ current, prev }: { current: number; prev: number }) {
  if (prev === 0 && current === 0) return <span className="text-xs text-muted-foreground">—</span>;
  if (prev === 0) return <span className="flex items-center gap-0.5 text-xs text-neon"><TrendingUp className="h-3 w-3" /> novo</span>;
  const pct = ((current - prev) / prev) * 100;
  const up = pct >= 0;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-semibold ${up ? "text-neon" : "text-destructive"}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

// ─── Card de métrica ──────────────────────────────────────────────────────────
function MetricCard({
  icon: Icon, label, value, prev, prevLabel, format = "number",
}: {
  icon: typeof DollarSign;
  label: string;
  value: number;
  prev: number;
  prevLabel: string;
  format?: "currency" | "number";
}) {
  const fmt = (v: number) => format === "currency" ? formatBRL(v) : String(Math.round(v));
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <Icon className="h-4 w-4 text-neon" />
        <Delta current={value} prev={prev} />
      </div>
      <p className="font-display text-2xl font-bold">{fmt(value)}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-[10px] text-muted-foreground border-t border-border pt-2">
        {prevLabel}: {fmt(prev)}
      </p>
    </div>
  );
}

// ─── Tooltip customizado do gráfico ──────────────────────────────────────────
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5 text-xs shadow-xl">
      <p className="mb-1.5 font-semibold text-muted-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className={p.name === "current" ? "text-neon" : "text-muted-foreground"}>
          {p.name === "current" ? "Atual" : "Anterior"}: {formatBRL(p.value)}
        </p>
      ))}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
function AdminReport() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) navigate({ to: "/login" });
      else if (profile && profile.role !== "admin") navigate({ to: "/" });
    }
  }, [user, profile, loading, navigate]);

  const [preset, setPreset] = useState("week");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const { start, end } = useMemo(() => {
    if (preset === "custom" && customStart && customEnd) {
      return { start: customStart, end: customEnd };
    }
    return getPreset(preset);
  }, [preset, customStart, customEnd]);

  const presetLabel: Record<string, string> = {
    today: "ontem",
    yesterday: "anteontem",
    week: "semana anterior",
    month: "30 dias anteriores",
    thismonth: "mês anterior",
    custom: "período anterior",
  };

  const { data: report, isLoading, isFetching } = useQuery({
    queryKey: ["sales-report", start, end],
    queryFn: () => getSalesReport({ data: { startDate: start, endDate: end } }),
    enabled: !!user && profile?.role === "admin" && !!start && !!end,
    staleTime: 2 * 60 * 1000,
  });

  const PRESETS = [
    { id: "today",     label: "Hoje" },
    { id: "yesterday", label: "Ontem" },
    { id: "week",      label: "7 dias" },
    { id: "month",     label: "30 dias" },
    { id: "thismonth", label: "Este mês" },
    { id: "custom",    label: "Personalizado" },
  ];

  const methodLabel: Record<string, string> = {
    pix: "Pix",
    credit_card: "Cartão",
    boleto: "Boleto",
  };

  if (loading || !profile) return null;

  return (
    <AdminLayout title="Relatório de Vendas">
      {/* Seletor de período */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                preset === p.id
                  ? "bg-neon text-primary-foreground"
                  : "border border-border hover:border-neon hover:text-neon"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Intervalo personalizado */}
        {preset === "custom" && (
          <div className="flex items-center gap-2 ml-2">
            <Calendar className="h-4 w-4 text-muted-foreground flex-none" />
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="h-8 rounded-md border border-border bg-secondary/50 px-2 text-xs focus:border-neon focus:outline-none"
            />
            <span className="text-xs text-muted-foreground">até</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="h-8 rounded-md border border-border bg-secondary/50 px-2 text-xs focus:border-neon focus:outline-none"
            />
          </div>
        )}

        {isFetching && <Loader2 className="h-4 w-4 animate-spin text-neon ml-1" />}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-7 w-7 animate-spin text-neon" />
        </div>
      ) : !report ? null : (
        <>
          {/* Cards de métricas */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard
              icon={DollarSign}
              label="Receita (pedidos pagos)"
              value={report.revenue}
              prev={report.prevRevenue}
              prevLabel={presetLabel[preset]}
              format="currency"
            />
            <MetricCard
              icon={ShoppingBag}
              label="Pedidos"
              value={report.orders}
              prev={report.prevOrders}
              prevLabel={presetLabel[preset]}
            />
            <MetricCard
              icon={TrendingUp}
              label="Ticket médio"
              value={report.avgTicket}
              prev={report.prevAvgTicket}
              prevLabel={presetLabel[preset]}
              format="currency"
            />
            <MetricCard
              icon={Users}
              label="Clientes únicos"
              value={report.newCustomers}
              prev={report.prevNewCustomers}
              prevLabel={presetLabel[preset]}
            />
          </div>

          {/* Gráfico de área — atual vs anterior */}
          <div className="mt-6 rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h2 className="font-display font-bold">Receita por dia</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Período atual <span className="text-neon">━</span> vs período anterior <span className="text-muted-foreground/50">╌</span>
                </p>
              </div>
              <div className="text-xs text-muted-foreground">
                {start} → {end}
              </div>
            </div>

            {report.chart.length <= 1 ? (
              /* Período de 1 dia: barras verticais simples */
              <div className="flex items-end justify-center gap-8 h-40 pb-4">
                {[
                  { label: "Atual", value: report.revenue, color: "bg-neon" },
                  { label: "Anterior", value: report.prevRevenue, color: "bg-muted-foreground/30" },
                ].map(({ label, value, color }) => {
                  const max = Math.max(report.revenue, report.prevRevenue, 1);
                  return (
                    <div key={label} className="flex flex-col items-center gap-2">
                      <span className="text-xs font-bold">{formatBRL(value)}</span>
                      <div className="w-16 bg-secondary rounded-t-md overflow-hidden" style={{ height: 80 }}>
                        <div
                          className={`${color} rounded-t-md transition-all w-full`}
                          style={{ height: `${(value / max) * 100}%`, marginTop: "auto" }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={report.chart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradCurrent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.92 0.27 142)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="oklch(0.92 0.27 142)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradPrev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#888" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#888" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#888" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#888" }} tickFormatter={(v) => `R$${v}`} width={56} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="previous"
                      stroke="#666"
                      strokeWidth={1.5}
                      strokeDasharray="4 2"
                      fill="url(#gradPrev)"
                      dot={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="current"
                      stroke="oklch(0.92 0.27 142)"
                      strokeWidth={2}
                      fill="url(#gradCurrent)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Linha inferior: produtos + pagamentos */}
          <div className="mt-6 grid gap-6 lg:grid-cols-2">

            {/* Top produtos */}
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Package className="h-4 w-4 text-neon" />
                <h2 className="font-display font-bold">Top produtos</h2>
              </div>

              {report.topProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhuma venda no período
                </p>
              ) : (
                <div className="space-y-3">
                  {report.topProducts.map((p, idx) => {
                    const maxRev = report.topProducts[0]?.revenue ?? 1;
                    return (
                      <div key={p.product_slug}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] font-bold text-muted-foreground w-4 flex-none">#{idx + 1}</span>
                            <Link
                              to="/produto/$slug"
                              params={{ slug: p.product_slug }}
                              className="truncate text-xs font-medium hover:text-neon transition-colors"
                            >
                              {p.product_name}
                            </Link>
                          </div>
                          <div className="text-right flex-none ml-2">
                            <span className="text-xs font-bold text-neon">{formatBRL(p.revenue)}</span>
                            <span className="text-[10px] text-muted-foreground ml-1">({p.quantity} un)</span>
                          </div>
                        </div>
                        <div className="h-1 w-full rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full bg-neon transition-all"
                            style={{ width: `${(p.revenue / maxRev) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Formas de pagamento */}
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 className="h-4 w-4 text-neon" />
                <h2 className="font-display font-bold">Formas de pagamento</h2>
              </div>

              {report.paymentBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhuma venda paga no período
                </p>
              ) : (
                <div className="space-y-4">
                  {report.paymentBreakdown.map((p) => {
                    const pct = report.revenue > 0 ? (p.revenue / report.revenue) * 100 : 0;
                    const colors: Record<string, string> = {
                      pix: "bg-neon",
                      credit_card: "bg-blue-400",
                      boleto: "bg-yellow-400",
                    };
                    return (
                      <div key={p.method}>
                        <div className="flex items-center justify-between text-sm mb-1.5">
                          <span className="text-xs font-semibold">{methodLabel[p.method] ?? p.method}</span>
                          <div className="text-right">
                            <span className="text-xs font-bold">{formatBRL(p.revenue)}</span>
                            <span className="text-[10px] text-muted-foreground ml-1.5">{pct.toFixed(0)}% · {p.count} pedido{p.count !== 1 ? "s" : ""}</span>
                          </div>
                        </div>
                        <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${colors[p.method] ?? "bg-foreground"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}

                  {/* Total */}
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
                    <span className="text-muted-foreground">Total confirmado</span>
                    <span className="font-display font-bold text-neon">{formatBRL(report.revenue)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}

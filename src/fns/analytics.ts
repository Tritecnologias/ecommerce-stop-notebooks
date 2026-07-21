import { createServerFn } from "@tanstack/react-start";
import { createSupabaseAdmin } from "@/lib/supabase";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type DayRevenue = {
  label: string;
  date: string;
  revenue: number;
  orders: number;
};

export type TopProduct = {
  product_name: string;
  product_slug: string;
  quantity: number;
  revenue: number;
};

export type StatusBreakdown = {
  status: string;
  count: number;
};

export type DashboardStats = {
  // KPIs principais
  revenueTotal: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  ordersThisMonth: number;
  ordersLastMonth: number;
  avgTicket: number;
  paidOrdersCount: number;
  cancelledCount: number;
  pendingCount: number;

  // Série temporal
  revenueByDay: DayRevenue[];   // últimos 30 dias
  revenueByDay7: DayRevenue[];  // últimos 7 dias

  // Breakdowns
  statusBreakdown: StatusBreakdown[];
  topProducts: TopProduct[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function startOfMonth(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}
function startOfLastMonth(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString();
}
function endOfLastMonth(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), 0, 23, 59, 59).toISOString();
}

// ─── Server function ──────────────────────────────────────────────────────────

export const getDashboardStats = createServerFn().handler(async (): Promise<DashboardStats> => {
  const db = createSupabaseAdmin();
  const now = new Date();

  // Busca pedidos dos últimos 60 dias (suficiente para todos os cálculos)
  const since60 = new Date(now);
  since60.setDate(since60.getDate() - 60);

  const [{ data: orders }, { data: items }] = await Promise.all([
    db
      .from("orders")
      .select("id, status, payment_status, total, created_at")
      .gte("created_at", since60.toISOString())
      .order("created_at", { ascending: false }),
    db
      .from("order_items")
      .select("product_name, product_slug, quantity, total_price, order_id")
      .gte("created_at", since60.toISOString()),
  ]);

  const allOrders = orders ?? [];
  const allItems = items ?? [];

  // ── Mês atual / anterior ──────────────────────────────────────────────────
  const monthStart = startOfMonth(now);
  const lastMonthStart = startOfLastMonth(now);
  const lastMonthEnd = endOfLastMonth(now);

  const thisMonthOrders = allOrders.filter((o) => o.created_at >= monthStart);
  const lastMonthOrders = allOrders.filter(
    (o) => o.created_at >= lastMonthStart && o.created_at <= lastMonthEnd,
  );

  const paidThisMonth = thisMonthOrders.filter((o) => o.payment_status === "paid");
  const paidLastMonth = lastMonthOrders.filter((o) => o.payment_status === "paid");

  const revenueThisMonth = paidThisMonth.reduce((s, o) => s + o.total, 0);
  const revenueLastMonth = paidLastMonth.reduce((s, o) => s + o.total, 0);

  // ── Todos pedidos pagos (60 dias) para total + ticket ────────────────────
  const paidOrders = allOrders.filter((o) => o.payment_status === "paid");
  const revenueTotal = paidOrders.reduce((s, o) => s + o.total, 0);
  const avgTicket = paidOrders.length > 0 ? revenueTotal / paidOrders.length : 0;

  // ── Status breakdown ─────────────────────────────────────────────────────
  const statusMap: Record<string, number> = {};
  for (const o of allOrders) {
    statusMap[o.status] = (statusMap[o.status] ?? 0) + 1;
  }
  const statusBreakdown: StatusBreakdown[] = Object.entries(statusMap)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  // ── Top produtos ─────────────────────────────────────────────────────────
  const productMap: Record<string, { qty: number; rev: number; slug: string }> = {};
  for (const item of allItems) {
    const key = item.product_name;
    if (!productMap[key]) productMap[key] = { qty: 0, rev: 0, slug: item.product_slug ?? "" };
    productMap[key].qty += item.quantity ?? 0;
    productMap[key].rev += item.total_price ?? 0;
  }
  const topProducts: TopProduct[] = Object.entries(productMap)
    .map(([name, d]) => ({
      product_name: name,
      product_slug: d.slug,
      quantity: d.qty,
      revenue: d.rev,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // ── Série temporal (30 dias) ──────────────────────────────────────────────
  const revenueByDay: DayRevenue[] = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (29 - i));
    const dateStr = d.toDateString();
    const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const dayPaid = paidOrders.filter((o) => new Date(o.created_at).toDateString() === dateStr);
    return {
      label,
      date: d.toISOString().slice(0, 10),
      revenue: dayPaid.reduce((s, o) => s + o.total, 0),
      orders: allOrders.filter((o) => new Date(o.created_at).toDateString() === dateStr).length,
    };
  });

  const revenueByDay7 = revenueByDay.slice(-7);

  return {
    revenueTotal,
    revenueThisMonth,
    revenueLastMonth,
    ordersThisMonth: thisMonthOrders.length,
    ordersLastMonth: lastMonthOrders.length,
    avgTicket,
    paidOrdersCount: paidOrders.length,
    cancelledCount: statusMap["cancelled"] ?? 0,
    pendingCount: statusMap["pending"] ?? 0,
    revenueByDay,
    revenueByDay7,
    statusBreakdown,
    topProducts,
  };
});

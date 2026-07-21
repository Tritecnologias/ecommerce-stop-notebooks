import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase";

export type DayData = {
  label: string;      // "01/05"
  current: number;    // receita do período atual
  previous: number;   // receita do período anterior
  orders: number;     // pedidos do período atual
};

export type TopProduct = {
  product_name: string;
  product_slug: string;
  quantity: number;
  revenue: number;
};

export type PaymentBreakdown = {
  method: string;
  count: number;
  revenue: number;
};

export type SalesReport = {
  // Período atual
  revenue: number;
  orders: number;
  avgTicket: number;
  newCustomers: number;

  // Período anterior (comparação)
  prevRevenue: number;
  prevOrders: number;
  prevAvgTicket: number;
  prevNewCustomers: number;

  // Chart diário (alinhado por índice de dia)
  chart: DayData[];

  // Ranking de produtos
  topProducts: TopProduct[];

  // Formas de pagamento
  paymentBreakdown: PaymentBreakdown[];
};

const ReportInput = z.object({
  startDate: z.string(), // ISO: "2026-05-01"
  endDate: z.string(),   // ISO: "2026-05-31"
});

function formatLabel(date: Date): string {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function diffDays(start: string, end: string): number {
  return Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 86_400_000,
  ) + 1;
}

function shiftRange(start: string, end: string): { prevStart: string; prevEnd: string } {
  const days = diffDays(start, end);
  const s = new Date(start);
  s.setDate(s.getDate() - days);
  const e = new Date(end);
  e.setDate(e.getDate() - days);
  return {
    prevStart: s.toISOString().slice(0, 10),
    prevEnd: e.toISOString().slice(0, 10),
  };
}

export const getSalesReport = createServerFn()
  .inputValidator((input: unknown) => ReportInput.parse(input))
  .handler(async ({ data: { startDate, endDate } }): Promise<SalesReport> => {
    const db = createSupabaseAdmin();

    const { prevStart, prevEnd } = shiftRange(startDate, endDate);

    // ── Busca pedidos dos dois períodos ──────────────────────────────────────
    const [{ data: curr }, { data: prev }] = await Promise.all([
      db
        .from("orders")
        .select("id, total, subtotal, payment_status, status, payment_method, customer_email, created_at, order_items(product_name, product_slug, quantity, unit_price)")
        .gte("created_at", `${startDate}T00:00:00.000Z`)
        .lte("created_at", `${endDate}T23:59:59.999Z`)
        .order("created_at", { ascending: true }),
      db
        .from("orders")
        .select("id, total, payment_status, customer_email, created_at")
        .gte("created_at", `${prevStart}T00:00:00.000Z`)
        .lte("created_at", `${prevEnd}T23:59:59.999Z`),
    ]);

    const currOrders = curr ?? [];
    const prevOrders = prev ?? [];

    // Só considera pedidos pagos para receita
    const paid = currOrders.filter((o) => o.payment_status === "paid");
    const prevPaid = prevOrders.filter((o) => o.payment_status === "paid");

    const revenue = paid.reduce((s, o) => s + Number(o.total), 0);
    const prevRevenue = prevPaid.reduce((s, o) => s + Number(o.total), 0);
    const orders = currOrders.length;
    const prevOrdersCount = prevOrders.length;
    const avgTicket = paid.length > 0 ? revenue / paid.length : 0;
    const prevAvgTicket = prevPaid.length > 0 ? prevRevenue / prevPaid.length : 0;

    // Novos clientes únicos por email
    const newCustomers = new Set(currOrders.map((o) => o.customer_email)).size;
    const prevNewCustomers = new Set(prevOrders.map((o) => o.customer_email)).size;

    // ── Chart: agrupa por dia ─────────────────────────────────────────────────
    const days = diffDays(startDate, endDate);
    const chart: DayData[] = [];

    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dayStr = d.toISOString().slice(0, 10);

      const dayPaid = paid.filter((o) => o.created_at.slice(0, 10) === dayStr);
      const dayOrders = currOrders.filter((o) => o.created_at.slice(0, 10) === dayStr);

      // Dia correspondente no período anterior
      const prevD = new Date(prevStart);
      prevD.setDate(prevD.getDate() + i);
      const prevDayStr = prevD.toISOString().slice(0, 10);
      const prevDayPaid = prevPaid.filter((o) => o.created_at.slice(0, 10) === prevDayStr);

      chart.push({
        label: formatLabel(d),
        current: dayPaid.reduce((s, o) => s + Number(o.total), 0),
        previous: prevDayPaid.reduce((s, o) => s + Number(o.total), 0),
        orders: dayOrders.length,
      });
    }

    // ── Top produtos ──────────────────────────────────────────────────────────
    const productMap = new Map<string, TopProduct>();
    for (const order of paid) {
      for (const item of (order.order_items as { product_name: string; product_slug: string; quantity: number; unit_price: number }[] | null) ?? []) {
        const key = item.product_slug;
        if (productMap.has(key)) {
          const p = productMap.get(key)!;
          p.quantity += item.quantity;
          p.revenue += item.unit_price * item.quantity;
        } else {
          productMap.set(key, {
            product_name: item.product_name,
            product_slug: item.product_slug,
            quantity: item.quantity,
            revenue: item.unit_price * item.quantity,
          });
        }
      }
    }
    const topProducts = [...productMap.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // ── Formas de pagamento ───────────────────────────────────────────────────
    const methodMap = new Map<string, PaymentBreakdown>();
    for (const order of paid) {
      const m = order.payment_method as string;
      if (methodMap.has(m)) {
        const p = methodMap.get(m)!;
        p.count += 1;
        p.revenue += Number(order.total);
      } else {
        methodMap.set(m, { method: m, count: 1, revenue: Number(order.total) });
      }
    }
    const paymentBreakdown = [...methodMap.values()].sort((a, b) => b.revenue - a.revenue);

    return {
      revenue, prevRevenue,
      orders, prevOrders: prevOrdersCount,
      avgTicket, prevAvgTicket,
      newCustomers, prevNewCustomers,
      chart,
      topProducts,
      paymentBreakdown,
    };
  });

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Search, ChevronDown, ChevronUp, Download } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { getAdminCustomers, getAdminOrders } from "@/fns/orders";
import { formatBRL } from "@/lib/cart";
import { AdminLayout } from "@/routes/admin/index";

export const Route = createFileRoute("/admin/clientes/")({
  head: () => ({ meta: [{ title: "Clientes — Admin Secret Desire" }] }),
  component: AdminClients,
});

const statusLabel: Record<string, string> = {
  pending: "Aguardando", confirmed: "Confirmado", processing: "Preparando",
  shipped: "Enviado", delivered: "Entregue", cancelled: "Cancelado",
};

function CustomerOrders({ email }: { email: string }) {
  const { data } = useQuery({
    queryKey: ["admin-customer-orders", email],
    queryFn: async () => {
      const result = await getAdminOrders({ data: { page: 1, limit: 50 } });
      return result.orders.filter((o) => o.customer_email === email);
    },
  });

  if (!data) return <div className="px-4 py-3 text-xs text-muted-foreground">Carregando…</div>;

  return (
    <div className="border-t border-border bg-secondary/10">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="px-6 py-2">Pedido</th>
            <th className="px-4 py-2">Data</th>
            <th className="px-4 py-2">Total</th>
            <th className="px-4 py-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((order) => (
            <tr key={order.id} className="hover:bg-secondary/20">
              <td className="px-6 py-2 font-mono font-semibold text-neon">#{order.order_number}</td>
              <td className="px-4 py-2 text-muted-foreground">{new Date(order.created_at).toLocaleDateString("pt-BR")}</td>
              <td className="px-4 py-2 font-semibold">{formatBRL(order.total)}</td>
              <td className="px-4 py-2 text-muted-foreground">{statusLabel[order.status] ?? order.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminClients() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) {
      if (!user) navigate({ to: "/login" });
      else if (profile && profile.role !== "admin") navigate({ to: "/" });
    }
  }, [user, profile, loading, navigate]);

  const { data: customers, isLoading } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: () => getAdminCustomers(),
    enabled: !!user && profile?.role === "admin",
  });

  const exportCsv = () => {
    if (!customers || customers.length === 0) { toast.error("Nenhum cliente para exportar"); return; }
    const headers = ["Nome", "Email", "Nº pedidos", "Total gasto (R$)", "Último pedido"];
    const lines = customers.map((c) => [
      `"${c.customer_name.replace(/"/g, '""')}"`,
      `"${c.customer_email}"`,
      String(c.order_count),
      c.total_spent.toFixed(2).replace(".", ","),
      new Date(c.last_order_at).toLocaleDateString("pt-BR"),
    ]);
    const csv = "﻿" + [headers.join(";"), ...lines.map((l) => l.join(";"))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `clientes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast.success(`${customers.length} clientes exportados`);
  };

  const filtered = (customers ?? []).filter(
    (c) =>
      c.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      c.customer_email.toLowerCase().includes(search.toLowerCase()),
  );

  const totalSpent = (customers ?? []).reduce((s, c) => s + c.total_spent, 0);
  const totalOrders = (customers ?? []).reduce((s, c) => s + c.order_count, 0);

  if (loading || !profile) return null;

  return (
    <AdminLayout title="Clientes">
      {/* Resumo */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        {[
          { label: "Clientes únicos", value: String(customers?.length ?? 0) },
          { label: "Total de pedidos", value: String(totalOrders) },
          { label: "Receita total", value: formatBRL(totalSpent) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1.5 font-display text-2xl font-bold text-neon">{value}</p>
          </div>
        ))}
      </div>

      {/* Busca + Exportar */}
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={exportCsv}
          disabled={isLoading || !customers?.length}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-semibold hover:border-neon hover:text-neon transition-colors disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </button>
        <p className="text-xs text-muted-foreground ml-auto">{filtered.length} de {customers?.length ?? 0} cliente{(customers?.length ?? 0) !== 1 ? "s" : ""}</p>
      </div>
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou e-mail…"
          className="h-10 w-full max-w-sm rounded-md border border-border bg-secondary/50 pl-9 pr-3 text-sm focus:border-neon focus:outline-none focus:ring-1 focus:ring-neon transition"
        />
      </div>

      {/* Tabela */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Pedidos</th>
              <th className="px-4 py-3">Total gasto</th>
              <th className="px-4 py-3">Último pedido</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum cliente encontrado.</td></tr>
            ) : (
              filtered.map((c) => (
                <>
                  <tr
                    key={c.customer_email}
                    className="border-b border-border hover:bg-secondary/20 transition-colors cursor-pointer"
                    onClick={() => setExpanded(expanded === c.customer_email ? null : c.customer_email)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-sm">{c.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{c.customer_email}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">{c.order_count}</td>
                    <td className="px-4 py-3 font-bold text-neon">{formatBRL(c.total_spent)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(c.last_order_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {expanded === c.customer_email
                        ? <ChevronUp className="h-4 w-4" />
                        : <ChevronDown className="h-4 w-4" />}
                    </td>
                  </tr>
                  {expanded === c.customer_email && (
                    <tr key={`${c.customer_email}-orders`}>
                      <td colSpan={5} className="p-0">
                        <CustomerOrders email={c.customer_email} />
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}

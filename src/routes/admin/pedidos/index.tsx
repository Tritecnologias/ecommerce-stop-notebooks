import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useOrderNotif } from "@/lib/order-notifications";
import { getAdminOrders } from "@/fns/orders";
import { formatBRL } from "@/lib/cart";
import { AdminLayout } from "@/routes/admin/index";

export const Route = createFileRoute("/admin/pedidos/")({
  head: () => ({ meta: [{ title: "Pedidos — Admin Secret Desire" }] }),
  component: AdminOrders,
});

const statusLabel: Record<string, string> = {
  pending: "Aguardando",
  confirmed: "Confirmado",
  processing: "Preparando",
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

const paymentStatusColor: Record<string, string> = {
  pending: "text-yellow-400",
  paid: "text-green-400",
  failed: "text-destructive",
  refunded: "text-blue-400",
  cancelled: "text-muted-foreground",
};

function AdminOrders() {
  const { user, profile, loading } = useAuth();
  const { markSeen } = useOrderNotif();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { markSeen(); }, [markSeen]);
  const limit = 20;

  useEffect(() => {
    if (!loading) {
      if (!user) navigate({ to: "/login" });
      else if (profile && profile.role !== "admin") navigate({ to: "/" });
    }
  }, [user, profile, loading, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders", statusFilter, page],
    queryFn: () => getAdminOrders({ data: { status: statusFilter === "all" ? undefined : statusFilter, page, limit } }),
    enabled: !!user && profile?.role === "admin",
  });

  const orders = data?.orders ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const result = await getAdminOrders({ data: { status: statusFilter === "all" ? undefined : statusFilter, page: 1, limit: 1000 } });
      const rows = result.orders;
      const headers = ["Pedido","Data","Cliente","E-mail","CPF","Telefone","Subtotal","Frete","Desconto","Total","Pagamento","Status","CEP","Endereço","Número","Bairro","Cidade","Estado"];
      const lines = rows.map((o) => [
        o.order_number,
        new Date(o.created_at).toLocaleDateString("pt-BR"),
        o.customer_name,
        o.customer_email,
        o.customer_cpf ?? "",
        o.customer_phone ?? "",
        o.subtotal.toFixed(2).replace(".", ","),
        o.shipping_cost.toFixed(2).replace(".", ","),
        o.discount.toFixed(2).replace(".", ","),
        o.total.toFixed(2).replace(".", ","),
        o.payment_method === "pix" ? "Pix" : o.payment_method === "credit_card" ? "Cartão" : "Boleto",
        statusLabel[o.status] ?? o.status,
        o.shipping_cep ?? "",
        o.shipping_street ?? "",
        o.shipping_number ?? "",
        o.shipping_neighborhood ?? "",
        o.shipping_city ?? "",
        o.shipping_state ?? "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"));

      const csv = "﻿" + [headers.join(";"), ...lines].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pedidos-${statusFilter}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Erro ao exportar pedidos");
    } finally {
      setExporting(false);
    }
  };

  if (loading || !profile) return null;

  return (
    <AdminLayout title="Pedidos">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {["all", "pending", "confirmed", "processing", "shipped", "delivered", "cancelled"].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              statusFilter === s
                ? "border-neon bg-neon/10 text-neon"
                : "border-border text-muted-foreground hover:border-foreground"
            }`}
          >
            {s === "all" ? "Todos" : statusLabel[s]}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{total} pedidos</span>
          <button
            onClick={exportCsv}
            disabled={exporting || total === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:border-neon hover:text-neon disabled:opacity-40 transition-colors"
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Pedido</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Pagamento</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={7} className="py-12 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-neon" /></td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhum pedido encontrado.</td></tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        to="/admin/pedidos/$id"
                        params={{ id: order.id }}
                        className="font-mono text-xs font-semibold text-neon hover:underline"
                      >
                        #{order.order_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-xs">{order.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{order.customer_email}</p>
                    </td>
                    <td className="px-4 py-3 font-bold text-neon">{formatBRL(order.total)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold ${paymentStatusColor[order.payment_status] ?? ""}`}>
                        {order.payment_status === "paid" ? "Pago" :
                         order.payment_status === "failed" ? "Falhou" :
                         order.payment_status === "refunded" ? "Estornado" : "Pendente"}
                      </span>
                      <p className="text-[10px] text-muted-foreground">
                        {order.payment_method === "pix" ? "Pix" :
                         order.payment_method === "credit_card" ? "Cartão" : "Boleto"}
                        {order.payment_gateway ? ` · ${order.payment_gateway}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusColor[order.status] ?? ""}`}>
                        {statusLabel[order.status] ?? order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to="/admin/pedidos/$id"
                        params={{ id: order.id }}
                        className="text-xs text-neon hover:underline"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </button>
            <span className="text-xs text-muted-foreground">Página {page} de {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              Próxima <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

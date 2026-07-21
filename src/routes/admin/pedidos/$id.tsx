import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Package, User, MapPin, CreditCard, Truck, Package2, FileDown, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getOrderById, updateOrderStatus } from "@/fns/orders";
import { generateCorreiosLabel } from "@/fns/correios";
import { triggerShippingNotification } from "@/fns/whatsapp";
import { formatBRL } from "@/lib/cart";
import { AdminLayout } from "@/routes/admin/index";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/pedidos/$id")({
  head: () => ({ meta: [{ title: "Detalhes do pedido — Admin" }] }),
  component: AdminOrderDetail,
});

const statusOptions = [
  { value: "pending", label: "Aguardando pagamento" },
  { value: "confirmed", label: "Confirmado" },
  { value: "processing", label: "Em preparação" },
  { value: "shipped", label: "Enviado" },
  { value: "delivered", label: "Entregue" },
  { value: "cancelled", label: "Cancelado" },
] as const;

function AdminOrderDetail() {
  const { id } = Route.useParams();
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [newStatus, setNewStatus] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [notes, setNotes] = useState("");
  const [labelPdf, setLabelPdf] = useState("");

  useEffect(() => {
    if (!loading) {
      if (!user) navigate({ to: "/login" });
      else if (profile && profile.role !== "admin") navigate({ to: "/" });
    }
  }, [user, profile, loading, navigate]);

  const { data: order, isLoading } = useQuery({
    queryKey: ["admin-order", id],
    queryFn: () => getOrderById({ data: id }),
    enabled: !!user && profile?.role === "admin",
  });

  useEffect(() => {
    if (order) {
      setNewStatus(order.status);
      setTrackingCode(order.tracking_code ?? "");
      setNotes(order.notes ?? "");
    }
  }, [order]);

  const updateMut = useMutation({
    mutationFn: () =>
      updateOrderStatus({
        data: {
          orderId: id,
          status: newStatus as "pending",
          trackingCode: trackingCode || undefined,
          notes: notes || undefined,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      toast.success("Pedido atualizado!");
      // Notifica cliente via WhatsApp quando marcado como Enviado
      if (newStatus === "shipped") {
        triggerShippingNotification({ data: id }).catch(console.error);
      }
    },
    onError: () => toast.error("Erro ao atualizar pedido"),
  });

  const labelMut = useMutation({
    mutationFn: () => generateCorreiosLabel({ data: id }),
    onSuccess: ({ trackingCode: code, labelPdfBase64 }) => {
      setTrackingCode(code);
      setNewStatus("shipped");
      if (labelPdfBase64) setLabelPdf(labelPdfBase64);
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      toast.success(`Etiqueta gerada! Rastreio: ${code}`);
      // Notifica cliente com o código de rastreio
      triggerShippingNotification({ data: id }).catch(console.error);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao gerar etiqueta"),
  });

  if (loading || !profile || isLoading) {
    return (
      <AdminLayout title="Pedido">
        <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-neon" /></div>
      </AdminLayout>
    );
  }

  if (!order) {
    return (
      <AdminLayout title="Pedido não encontrado">
        <p className="text-muted-foreground">Este pedido não existe.</p>
      </AdminLayout>
    );
  }

  const paymentLabel = { pix: "Pix", credit_card: "Cartão de Crédito", boleto: "Boleto" };
  const payStatusLabel = { pending: "Pendente", paid: "Pago", failed: "Falhou", refunded: "Estornado", cancelled: "Cancelado" };
  const payStatusColor = { pending: "text-yellow-400", paid: "text-green-400", failed: "text-destructive", refunded: "text-blue-400", cancelled: "text-muted-foreground" };

  return (
    <AdminLayout title={`Pedido #${order.order_number}`}>
      <div className="mb-4">
        <Link to="/admin/pedidos" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {/* Items */}
          <Card title="Itens do pedido" icon={Package}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="pb-2">Produto</th>
                  <th className="pb-2">Qtd</th>
                  <th className="pb-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {order.order_items?.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3 flex items-center gap-3">
                      {item.product_image && (
                        <img src={item.product_image} alt="" className="h-10 w-10 rounded-md object-cover flex-none" />
                      )}
                      <div>
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-xs text-muted-foreground">{item.size} · {formatBRL(item.unit_price)}/un</p>
                      </div>
                    </td>
                    <td className="py-3">{item.quantity}x</td>
                    <td className="py-3 text-right font-semibold">{formatBRL(item.total_price)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-border">
                <tr><td colSpan={2} className="pt-3 text-muted-foreground text-xs">Subtotal</td><td className="pt-3 text-right">{formatBRL(order.subtotal)}</td></tr>
                <tr><td colSpan={2} className="text-muted-foreground text-xs">Frete</td><td className="text-right">{order.shipping_cost === 0 ? <span className="text-neon">Grátis</span> : formatBRL(order.shipping_cost)}</td></tr>
                <tr className="font-bold text-neon"><td colSpan={2} className="pt-2 text-base">Total</td><td className="pt-2 text-right text-base">{formatBRL(order.total)}</td></tr>
              </tfoot>
            </table>
          </Card>

          {/* Customer */}
          <Card title="Cliente" icon={User}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <InfoRow label="Nome" value={order.customer_name} />
              <InfoRow label="E-mail" value={order.customer_email} />
              <InfoRow label="Telefone" value={order.customer_phone} />
              <InfoRow label="CPF" value={order.customer_cpf} />
            </dl>
          </Card>

          {/* Shipping */}
          <Card title="Endereço de entrega" icon={MapPin}>
            <address className="not-italic text-sm text-muted-foreground leading-6">
              {order.shipping_street}, {order.shipping_number}
              {order.shipping_complement && ` — ${order.shipping_complement}`}<br />
              {order.shipping_neighborhood} — {order.shipping_city}/{order.shipping_state}<br />
              CEP {order.shipping_cep}
            </address>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Payment */}
          <Card title="Pagamento" icon={CreditCard}>
            <dl className="space-y-2 text-sm">
              <InfoRow label="Método" value={paymentLabel[order.payment_method]} />
              <InfoRow label="Gateway" value={order.payment_gateway ?? "—"} />
              <InfoRow label="Status" value={
                <span className={payStatusColor[order.payment_status] ?? ""}>{payStatusLabel[order.payment_status]}</span>
              } />
              {order.payment_id && <InfoRow label="ID externo" value={<span className="font-mono text-xs">{order.payment_id}</span>} />}
            </dl>
          </Card>

          {/* Status update */}
          <Card title="Atualizar pedido" icon={Truck}>
            <div className="space-y-3">

              {/* ── Etiqueta Correios ──────────────────────────────────── */}
              <div className="rounded-md border border-dashed border-border bg-secondary/10 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Package2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-semibold leading-tight">Etiqueta Correios</p>
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                        Gera automaticamente o código de rastreio
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => labelMut.mutate()}
                    disabled={labelMut.isPending}
                    className="inline-flex flex-none items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-semibold transition-colors hover:border-neon hover:text-neon disabled:opacity-50"
                  >
                    {labelMut.isPending ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando…</>
                    ) : (
                      <><Package2 className="h-3.5 w-3.5" /> Gerar Etiqueta</>
                    )}
                  </button>
                </div>

                {/* Estado após geração */}
                {labelMut.isSuccess && (
                  <div className="mt-2.5 space-y-1.5 border-t border-border pt-2.5">
                    <p className="flex items-center gap-1.5 text-xs text-green-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Etiqueta gerada · pedido marcado como <strong>Enviado</strong>
                    </p>
                    {labelPdf && (
                      <a
                        href={labelPdf}
                        download={`etiqueta-${order.order_number}.pdf`}
                        className="flex items-center gap-1.5 text-xs text-neon hover:underline"
                      >
                        <FileDown className="h-3.5 w-3.5" /> Baixar etiqueta PDF
                      </a>
                    )}
                  </div>
                )}

                {labelMut.isError && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-none" />
                    {labelMut.error instanceof Error
                      ? labelMut.error.message
                      : "Falha ao gerar etiqueta"}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-secondary/50 px-3 text-sm focus:border-neon focus:outline-none"
                >
                  {statusOptions.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Código de rastreio</label>
                <input
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value)}
                  placeholder="BR123456789BR"
                  className="h-10 w-full rounded-md border border-border bg-secondary/50 px-3 text-sm font-mono focus:border-neon focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Notas internas</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm focus:border-neon focus:outline-none resize-none"
                />
              </div>
              <button
                onClick={() => updateMut.mutate()}
                disabled={updateMut.isPending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-neon py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60 glow"
              >
                {updateMut.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</> : "Salvar"}
              </button>
            </div>
          </Card>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>Criado: {new Date(order.created_at).toLocaleString("pt-BR")}</p>
            <p>Atualizado: {new Date(order.updated_at).toLocaleString("pt-BR")}</p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon: typeof Package; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-neon" />
        <h3 className="font-display font-semibold text-sm">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-xs font-medium">{value ?? "—"}</dd>
    </>
  );
}

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ToggleLeft, ToggleRight, Tag, TrendingDown, Hash, Percent } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getAdminCoupons, getAdminCouponStats, updateCoupon, deleteCoupon } from "@/fns/coupons";
import { formatBRL } from "@/lib/cart";
import { AdminLayout } from "@/routes/admin/index";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/cupons/")({
  head: () => ({ meta: [{ title: "Cupons — Admin Secret Desire" }] }),
  component: AdminCoupons,
});

function AdminCoupons() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading) {
      if (!user) navigate({ to: "/login" });
      else if (profile && profile.role !== "admin") navigate({ to: "/" });
    }
  }, [user, profile, loading, navigate]);

  const { data: coupons, isLoading } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: () => getAdminCoupons(),
    enabled: !!user && profile?.role === "admin",
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-coupon-stats"],
    queryFn: () => getAdminCouponStats(),
    enabled: !!user && profile?.role === "admin",
    staleTime: 2 * 60 * 1000,
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      updateCoupon({ data: { id, data: { active } } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-coupons"] }),
    onError: () => toast.error("Erro ao atualizar cupom"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteCoupon({ data: id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
      toast.success("Cupom excluído");
    },
    onError: () => toast.error("Erro ao excluir cupom"),
  });

  if (loading || !profile) return null;

  return (
    <AdminLayout title="Cupons">
      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Tag className="h-3.5 w-3.5" /> Cupons ativos
          </div>
          <p className="font-display text-2xl font-bold text-neon">{stats?.totalActive ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <TrendingDown className="h-3.5 w-3.5" /> Desconto concedido
          </div>
          <p className="font-display text-2xl font-bold text-neon">
            {stats ? formatBRL(stats.totalDiscountGranted) : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Percent className="h-3.5 w-3.5" /> Pedidos c/ cupom
          </div>
          <p className="font-display text-2xl font-bold text-neon">
            {stats
              ? stats.totalOrders > 0
                ? `${Math.round((stats.ordersWithCoupon / stats.totalOrders) * 100)}%`
                : "0%"
              : "—"}
          </p>
          {stats && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {stats.ordersWithCoupon} de {stats.totalOrders} pedidos
            </p>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Hash className="h-3.5 w-3.5" /> Mais usado
          </div>
          {stats?.topCoupon ? (
            <>
              <p className="font-display text-lg font-bold font-mono tracking-widest text-neon">{stats.topCoupon.code}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{stats.topCoupon.uses} uso{stats.topCoupon.uses !== 1 ? "s" : ""}</p>
            </>
          ) : (
            <p className="font-display text-2xl font-bold">—</p>
          )}
        </div>
      </div>

      <div className="mb-5 flex items-center justify-end">
        <Link
          to="/admin/cupons/novo"
          className="inline-flex items-center gap-2 rounded-md bg-neon px-4 py-2.5 text-sm font-bold text-primary-foreground glow transition-transform hover:scale-[1.01]"
        >
          <Plus className="h-4 w-4" /> Novo cupom
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Pedido mín.</th>
                <th className="px-4 py-3">Usos</th>
                <th className="px-4 py-3">Expira em</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td>
                </tr>
              ) : coupons?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Nenhum cupom cadastrado.</td>
                </tr>
              ) : (
                coupons?.map((coupon) => (
                  <tr key={coupon.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold tracking-widest">{coupon.code}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border ${
                        coupon.type === "percent"
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                          : "bg-purple-500/10 text-purple-400 border-purple-500/30"
                      }`}>
                        {coupon.type === "percent" ? "Percentual" : "Valor fixo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {coupon.type === "percent"
                        ? `${coupon.value}%`
                        : formatBRL(coupon.value)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {coupon.min_order > 0 ? formatBRL(coupon.min_order) : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {coupon.used_count}/{coupon.max_uses ?? "∞"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {coupon.expires_at
                        ? new Date(coupon.expires_at).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleMut.mutate({ id: coupon.id, active: !coupon.active })}
                        disabled={toggleMut.isPending}
                        className="flex items-center gap-1.5 text-xs"
                      >
                        {coupon.active
                          ? <ToggleRight className="h-5 w-5 text-neon" />
                          : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                        <span className={coupon.active ? "text-neon" : "text-muted-foreground"}>
                          {coupon.active ? "Ativo" : "Inativo"}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          if (confirm(`Excluir cupom "${coupon.code}"?`)) deleteMut.mutate(coupon.id);
                        }}
                        disabled={deleteMut.isPending}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:border-destructive hover:text-destructive transition-colors"
                        title="Excluir cupom"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { createCoupon } from "@/fns/coupons";
import { AdminLayout } from "@/routes/admin/index";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/cupons/novo")({
  head: () => ({ meta: [{ title: "Novo cupom — Admin" }] }),
  component: NewCoupon,
});

function NewCoupon() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading) {
      if (!user) navigate({ to: "/login" });
      else if (profile && profile.role !== "admin") navigate({ to: "/" });
    }
  }, [user, profile, loading, navigate]);

  const [code, setCode] = useState("");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("");
  const [minOrder, setMinOrder] = useState("0");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [active, setActive] = useState(true);

  const mutation = useMutation({
    mutationFn: () =>
      createCoupon({
        data: {
          code,
          type,
          value: parseFloat(value),
          min_order: parseFloat(minOrder) || 0,
          max_uses: maxUses ? parseInt(maxUses, 10) : null,
          expires_at: expiresAt || null,
          active,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
      toast.success("Cupom criado!");
      navigate({ to: "/admin/cupons" });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao criar cupom"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !value) { toast.error("Preencha os campos obrigatórios"); return; }
    mutation.mutate();
  };

  if (loading || !profile) return null;

  return (
    <AdminLayout title="Novo cupom">
      <div className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-border bg-card p-6">

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Código *</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="PROMO20"
              required
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono uppercase tracking-widest focus:border-neon focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tipo *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "percent" | "fixed")}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-neon focus:outline-none"
              >
                <option value="percent">Percentual (%)</option>
                <option value="fixed">Valor fixo (R$)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Valor *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={type === "percent" ? "20" : "10.00"}
                required
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-neon focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Pedido mínimo (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value)}
                placeholder="0"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-neon focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Limite de usos{" "}
                <span className="text-muted-foreground font-normal">(vazio = ilimitado)</span>
              </label>
              <input
                type="number"
                step="1"
                min="1"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="∞"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-neon focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Expira em{" "}
              <span className="text-muted-foreground font-normal">(opcional)</span>
            </label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-neon focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="active"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-neon"
            />
            <label htmlFor="active" className="text-sm font-medium cursor-pointer">Ativo</label>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate({ to: "/admin/cupons" })}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-md bg-neon px-4 py-2 text-sm font-bold text-primary-foreground glow transition-transform hover:scale-[1.01] disabled:opacity-50"
            >
              {mutation.isPending ? "Criando…" : "Criar cupom"}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}

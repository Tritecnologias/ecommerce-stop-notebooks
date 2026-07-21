import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, User, Package, LogOut, Heart, Star } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { getLoyaltySummary } from "@/fns/loyalty";

export const Route = createFileRoute("/conta/")({
  head: () => ({ meta: [{ title: "Minha conta — Secret Desire" }] }),
  component: Account,
});

const schema = z.object({
  name: z.string().min(2),
  phone: z.string().optional(),
  cpf: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

function Account() {
  const { user, profile, loading, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const { register, handleSubmit, reset, formState: { isSubmitting, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", phone: "", cpf: "" },
  });

  useEffect(() => {
    if (profile) {
      reset({ name: profile.name ?? "", phone: profile.phone ?? "", cpf: profile.cpf ?? "" });
    }
  }, [profile, reset]);

  const [saving, setSaving] = useState(false);

  const { data: loyalty } = useQuery({
    queryKey: ["loyalty", user?.id],
    queryFn: () => getLoyaltySummary({ data: user!.id }),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const onSave = async (values: FormData) => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ name: values.name, phone: values.phone ?? null, cpf: values.cpf ?? null, updated_at: new Date().toISOString() })
      .eq("id", user!.id);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar"); return; }
    await refreshProfile();
    toast.success("Dados atualizados!");
  };

  const handleLogout = async () => {
    await logout();
    navigate({ to: "/" });
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-neon" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 md:px-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Minha conta</h1>
          <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors">
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Sidebar */}
        <nav className="space-y-1">
          <NavItem to="/conta" icon={User} label="Meus dados" active />
          <NavItem to="/conta/pedidos" icon={Package} label="Meus pedidos" />
          <NavItem to="/conta/favoritos" icon={Heart} label="Meus favoritos" />
          {profile?.role === "admin" && (
            <NavItem to="/admin" icon={User} label="Painel admin" />
          )}
        </nav>

        {/* Loyalty card */}
        {loyalty?.config.enabled && (
          <div className="lg:col-span-2 lg:col-start-2 rounded-lg border border-neon/30 bg-neon/5 p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-neon/10 text-neon">
              <Star className="h-6 w-6 fill-neon" />
            </div>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-widest text-neon font-semibold">Pontos de fidelidade</p>
              <p className="text-2xl font-display font-bold mt-0.5">
                {loyalty.balance.toLocaleString("pt-BR")}{" "}
                <span className="text-sm font-normal text-muted-foreground">pontos</span>
              </p>
              {loyalty.balance >= loyalty.config.minRedeemPoints ? (
                <p className="text-xs text-green-400 mt-0.5">
                  Equivale a R$ {(loyalty.balance * loyalty.config.redeemRatio).toFixed(2).replace(".", ",")} em desconto
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Acumule {loyalty.config.minRedeemPoints} pontos para resgatar
                </p>
              )}
            </div>
            {loyalty.history.length > 0 && (
              <div className="hidden md:block text-right text-xs text-muted-foreground">
                <p>Último ganho</p>
                <p className="text-foreground font-semibold">+{loyalty.history[0].points} pontos</p>
                <p>{new Date(loyalty.history[0].created_at).toLocaleDateString("pt-BR")}</p>
              </div>
            )}
          </div>
        )}

        {/* Form */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="font-display text-xl font-bold mb-6">Dados pessoais</h2>
          <form onSubmit={handleSubmit(onSave)} className="space-y-4">
            <FormField label="Nome completo">
              <input {...register("name")} className={inputCls} />
            </FormField>
            <FormField label="E-mail (não editável)">
              <input value={user.email ?? ""} disabled className={inputCls + " opacity-50 cursor-not-allowed"} />
            </FormField>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Telefone">
                <input {...register("phone")} placeholder="(11) 99999-9999" className={inputCls} />
              </FormField>
              <FormField label="CPF">
                <input {...register("cpf")} placeholder="000.000.000-00" className={inputCls} />
              </FormField>
            </div>
            <button
              type="submit"
              disabled={saving || isSubmitting || !isDirty}
              className="inline-flex items-center gap-2 rounded-md bg-neon px-6 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50 glow transition-transform hover:scale-[1.01]"
            >
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</> : "Salvar alterações"}
            </button>
          </form>
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

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "h-11 w-full rounded-md border border-border bg-secondary/50 px-3 text-sm placeholder:text-muted-foreground focus:border-neon focus:outline-none focus:ring-1 focus:ring-neon transition";

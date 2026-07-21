import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ToggleLeft, ToggleRight, Pencil, X, Save, Loader2, ImageIcon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getAdminBanners, createBanner, updateBanner, deleteBanner, type Banner } from "@/fns/banners";
import { AdminLayout } from "@/routes/admin/index";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/banners/")({
  head: () => ({ meta: [{ title: "Banners — Admin Secret Desire" }] }),
  component: AdminBanners,
});

const inputCls =
  "h-10 w-full rounded-md border border-border bg-background/50 px-3 text-sm placeholder:text-muted-foreground focus:border-neon focus:outline-none focus:ring-1 focus:ring-neon transition";

type FormState = {
  title: string;
  subtitle: string;
  badge: string;
  bg_from: string;
  bg_to: string;
  button_label: string;
  button_url: string;
  sort_order: string;
  active: boolean;
};

const EMPTY_FORM: FormState = {
  title: "",
  subtitle: "",
  badge: "",
  bg_from: "#0f172a",
  bg_to: "#1e293b",
  button_label: "",
  button_url: "",
  sort_order: "0",
  active: true,
};

function bannerToForm(b: Banner): FormState {
  return {
    title: b.title,
    subtitle: b.subtitle ?? "",
    badge: b.badge ?? "",
    bg_from: b.bg_from,
    bg_to: b.bg_to,
    button_label: b.button_label ?? "",
    button_url: b.button_url ?? "",
    sort_order: String(b.sort_order),
    active: b.active,
  };
}

function BannerPreview({ form }: { form: FormState }) {
  return (
    <div
      className="flex items-center gap-4 rounded-lg px-5 py-4 text-white"
      style={{ background: `linear-gradient(135deg, ${form.bg_from}, ${form.bg_to})` }}
    >
      <div className="flex-1 min-w-0">
        {form.badge && (
          <span className="mb-1 inline-block rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
            {form.badge}
          </span>
        )}
        <p className="font-display font-bold text-lg leading-tight">{form.title || "Título do banner"}</p>
        {form.subtitle && <p className="text-sm text-white/70 mt-0.5">{form.subtitle}</p>}
      </div>
      {form.button_label && (
        <span className="flex-none rounded-md bg-white/20 px-4 py-1.5 text-sm font-semibold">
          {form.button_label}
        </span>
      )}
    </div>
  );
}

function BannerForm({
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  initial: FormState;
  onSave: (f: FormState) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  return (
    <div className="rounded-lg border border-neon/30 bg-card p-5 space-y-4">
      <BannerPreview form={form} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Título *</label>
          <input value={form.title} onChange={set("title")} placeholder="Ex: Promoção de Verão" className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Subtítulo</label>
          <input value={form.subtitle} onChange={set("subtitle")} placeholder="Frase de apoio" className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Badge (etiqueta)</label>
          <input value={form.badge} onChange={set("badge")} placeholder="PROMO, NOVO, EXCLUSIVO…" className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Ordem</label>
          <input type="number" min="0" value={form.sort_order} onChange={set("sort_order")} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Cor inicial (hex)</label>
          <div className="flex gap-2">
            <input type="color" value={form.bg_from} onChange={set("bg_from")} className="h-10 w-12 cursor-pointer rounded border border-border bg-transparent" />
            <input value={form.bg_from} onChange={set("bg_from")} className={inputCls} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Cor final (hex)</label>
          <div className="flex gap-2">
            <input type="color" value={form.bg_to} onChange={set("bg_to")} className="h-10 w-12 cursor-pointer rounded border border-border bg-transparent" />
            <input value={form.bg_to} onChange={set("bg_to")} className={inputCls} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Texto do botão</label>
          <input value={form.button_label} onChange={set("button_label")} placeholder="Ver ofertas" className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">URL do botão</label>
          <input value={form.button_url} onChange={set("button_url")} placeholder="/produtos ou URL absoluta" className={inputCls} />
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-sm">
        <input type="checkbox" checked={form.active} onChange={set("active")} className="h-4 w-4 rounded accent-green-400" />
        Ativo (visível na loja)
      </label>

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={() => onSave(form)}
          disabled={isPending || !form.title.trim()}
          className="inline-flex items-center gap-2 rounded-md bg-neon px-4 py-2 text-sm font-bold text-primary-foreground glow disabled:opacity-40"
        >
          {isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…</> : <><Save className="h-3.5 w-3.5" /> Salvar</>}
        </button>
        <button onClick={onCancel} className="text-sm text-muted-foreground hover:text-foreground">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function AdminBanners() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) {
      if (!user) navigate({ to: "/login" });
      else if (profile && profile.role !== "admin") navigate({ to: "/" });
    }
  }, [user, profile, loading, navigate]);

  const { data: banners, isLoading } = useQuery({
    queryKey: ["admin-banners"],
    queryFn: () => getAdminBanners(),
    enabled: !!user && profile?.role === "admin",
  });

  const createMut = useMutation({
    mutationFn: (form: FormState) =>
      createBanner({
        data: {
          title: form.title,
          subtitle: form.subtitle || null,
          badge: form.badge || null,
          bg_from: form.bg_from,
          bg_to: form.bg_to,
          button_label: form.button_label || null,
          button_url: form.button_url || null,
          active: form.active,
          sort_order: parseInt(form.sort_order, 10) || 0,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-banners"] });
      setCreating(false);
      toast.success("Banner criado!");
    },
    onError: () => toast.error("Erro ao criar banner"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, form }: { id: string; form: FormState }) =>
      updateBanner({
        data: {
          id,
          data: {
            title: form.title,
            subtitle: form.subtitle || null,
            badge: form.badge || null,
            bg_from: form.bg_from,
            bg_to: form.bg_to,
            button_label: form.button_label || null,
            button_url: form.button_url || null,
            active: form.active,
            sort_order: parseInt(form.sort_order, 10) || 0,
          },
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-banners"] });
      setEditingId(null);
      toast.success("Banner atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar banner"),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      updateBanner({ data: { id, data: { active } } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-banners"] }),
    onError: () => toast.error("Erro ao atualizar banner"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteBanner({ data: id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-banners"] });
      toast.success("Banner excluído");
    },
    onError: () => toast.error("Erro ao excluir banner"),
  });

  if (loading || !profile) return null;

  return (
    <AdminLayout title="Banners">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Banners aparecem na página inicial entre o hero e a coleção de produtos. Ordene pelo campo "Ordem".
        </p>
        {!creating && (
          <button
            onClick={() => { setCreating(true); setEditingId(null); }}
            className="inline-flex items-center gap-2 rounded-md bg-neon px-4 py-2.5 text-sm font-bold text-primary-foreground glow transition-transform hover:scale-[1.01]"
          >
            <Plus className="h-4 w-4" /> Novo banner
          </button>
        )}
      </div>

      {creating && (
        <div className="mb-6">
          <BannerForm
            initial={EMPTY_FORM}
            onSave={(form) => createMut.mutate(form)}
            onCancel={() => setCreating(false)}
            isPending={createMut.isPending}
          />
        </div>
      )}

      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : banners?.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
            <ImageIcon className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhum banner cadastrado.</p>
            <button onClick={() => setCreating(true)} className="mt-3 text-sm text-neon hover:underline">
              Criar o primeiro banner
            </button>
          </div>
        ) : (
          banners?.map((banner) => (
            <div key={banner.id} className={`rounded-lg border bg-card overflow-hidden ${banner.active ? "border-border" : "border-border opacity-50"}`}>
              {editingId === banner.id ? (
                <div className="p-5">
                  <BannerForm
                    initial={bannerToForm(banner)}
                    onSave={(form) => updateMut.mutate({ id: banner.id, form })}
                    onCancel={() => setEditingId(null)}
                    isPending={updateMut.isPending}
                  />
                </div>
              ) : (
                <>
                  {/* Preview */}
                  <div
                    className="flex items-center gap-4 px-5 py-4 text-white"
                    style={{ background: `linear-gradient(135deg, ${banner.bg_from}, ${banner.bg_to})` }}
                  >
                    <div className="flex-1 min-w-0">
                      {banner.badge && (
                        <span className="mb-1 inline-block rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                          {banner.badge}
                        </span>
                      )}
                      <p className="font-display font-bold text-lg leading-tight">{banner.title}</p>
                      {banner.subtitle && <p className="text-sm text-white/70 mt-0.5">{banner.subtitle}</p>}
                    </div>
                    {banner.button_label && (
                      <span className="flex-none rounded-md bg-white/20 px-4 py-1.5 text-sm font-semibold">
                        {banner.button_label}
                      </span>
                    )}
                  </div>

                  {/* Actions row */}
                  <div className="flex items-center gap-3 border-t border-border px-4 py-2">
                    <span className="text-xs text-muted-foreground">Ordem: {banner.sort_order}</span>
                    <span className="ml-auto" />
                    <button
                      onClick={() => toggleMut.mutate({ id: banner.id, active: !banner.active })}
                      disabled={toggleMut.isPending}
                      className="flex items-center gap-1.5 text-xs"
                    >
                      {banner.active
                        ? <ToggleRight className="h-5 w-5 text-neon" />
                        : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                      <span className={banner.active ? "text-neon" : "text-muted-foreground"}>
                        {banner.active ? "Ativo" : "Inativo"}
                      </span>
                    </button>
                    <button
                      onClick={() => { setEditingId(banner.id); setCreating(false); }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:border-neon hover:text-neon transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => { if (confirm(`Excluir banner "${banner.title}"?`)) deleteMut.mutate(banner.id); }}
                      disabled={deleteMut.isPending}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:border-destructive hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </AdminLayout>
  );
}

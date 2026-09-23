import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Save, Loader2, Plus, X, Truck, Shield, Star, Gift, Zap, Heart, Lock, Package, Award, Clock,
  Eye, EyeOff, Home, Sparkles, ChevronDown, ChevronUp, UploadCloud, Image as ImageIcon,
  ArrowRight, RotateCcw, Trash2, ExternalLink,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getHomeContent, updateHomeContent, DEFAULT_HOME, type HomeContent, type TrustBadgeIcon } from "@/fns/home";
import { getProductImageUploadUrl } from "@/fns/storage";
import heroImg from "@/assets/hero.jpg";
import { AdminLayout } from "@/routes/admin/index";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/home/")({
  head: () => ({ meta: [{ title: "Página Inicial — Admin Secret Desire" }] }),
  component: AdminHome,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
const inputCls =
  "h-10 w-full rounded-md border border-border bg-background/50 px-3 text-sm placeholder:text-muted-foreground focus:border-neon focus:outline-none focus:ring-1 focus:ring-neon transition";
const textareaCls =
  "w-full rounded-md border border-border bg-background/50 px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-neon focus:outline-none focus:ring-1 focus:ring-neon transition resize-y";

const ICON_OPTIONS: { id: TrustBadgeIcon; Icon: typeof Truck; label: string }[] = [
  { id: "truck",   Icon: Truck,   label: "Caminhão"  },
  { id: "shield",  Icon: Shield,  label: "Escudo"    },
  { id: "star",    Icon: Star,    label: "Estrela"   },
  { id: "gift",    Icon: Gift,    label: "Presente"  },
  { id: "zap",     Icon: Zap,     label: "Raio"      },
  { id: "heart",   Icon: Heart,   label: "Coração"   },
  { id: "lock",    Icon: Lock,    label: "Cadeado"   },
  { id: "package", Icon: Package, label: "Caixa"     },
  { id: "award",   Icon: Award,   label: "Troféu"    },
  { id: "clock",   Icon: Clock,   label: "Relógio"   },
];

function getIcon(id: TrustBadgeIcon) {
  return ICON_OPTIONS.find((o) => o.id === id)?.Icon ?? Shield;
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-xs font-medium text-muted-foreground">{children}</label>;
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left font-display font-semibold text-sm"
      >
        {title}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="border-t border-border px-5 pb-5 pt-4 space-y-4">{children}</div>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
function AdminHome() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading) {
      if (!user) navigate({ to: "/login" });
      else if (profile && profile.role !== "admin") navigate({ to: "/" });
    }
  }, [user, profile, loading, navigate]);

  const { data: remote, isLoading } = useQuery({
    queryKey: ["home-content"],
    queryFn: () => getHomeContent(),
    enabled: !!user && profile?.role === "admin",
    staleTime: 30 * 1000,
  });

  const [content, setContent] = useState<HomeContent>(DEFAULT_HOME);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (remote && !initialized) {
      setContent(remote);
      setInitialized(true);
    }
  }, [remote, initialized]);

  const set = useCallback(<K extends keyof HomeContent>(key: K, value: HomeContent[K]) => {
    setContent((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setHero = useCallback((patch: Partial<HomeContent["hero"]>) => {
    setContent((prev) => ({ ...prev, hero: { ...prev.hero, ...patch } }));
  }, []);

  const setPromoBar = useCallback((patch: Partial<HomeContent["promoBar"]>) => {
    setContent((prev) => ({ ...prev, promoBar: { ...prev.promoBar, ...patch } }));
  }, []);

  const setSections = useCallback((patch: Partial<HomeContent["sections"]>) => {
    setContent((prev) => ({ ...prev, sections: { ...prev.sections, ...patch } }));
  }, []);

  const [uploadingHero, setUploadingHero] = useState(false);
  const heroFileRef = useRef<HTMLInputElement>(null);

  const handleHeroUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione um arquivo de imagem.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("A imagem não pode ultrapassar 10MB.");
      return;
    }

    setUploadingHero(true);
    try {
      const { uploadUrl, publicUrl } = await getProductImageUploadUrl({
        data: {
          fileName: file.name,
          contentType: file.type,
        },
      });

      const res = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!res.ok) throw new Error(`Falha no upload (Status ${res.status})`);

      setHero({ imageUrl: publicUrl });
      toast.success("Imagem do Hero enviada com sucesso!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no envio da imagem.");
    } finally {
      setUploadingHero(false);
    }
  };

  const saveMut = useMutation({
    mutationFn: () => updateHomeContent({ data: content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["home-content"] });
      toast.success("Página inicial salva!");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar"),
  });

  if (loading || !profile) return null;

  return (
    <AdminLayout title="Página Inicial">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Personalize a seção de destaque (Hero Banner), textos, botões e imagens da tela principal da loja.
        </p>
        <Link
          to="/"
          target="_blank"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neon hover:underline flex-none"
        >
          Ver loja ao vivo <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando conteúdo…
        </div>
      ) : (
        <form
          onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }}
          className="space-y-5"
        >

          {/* ── Barra Promocional ── */}
          <Section title="🎯 Barra promocional (topo da página)">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPromoBar({ visible: !content.promoBar.visible })}
                className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  content.promoBar.visible
                    ? "border-neon bg-neon/10 text-neon"
                    : "border-border text-muted-foreground"
                }`}
              >
                {content.promoBar.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                {content.promoBar.visible ? "Visível" : "Oculto"}
              </button>
              <span className="text-xs text-muted-foreground">Faixa colorida acima do header com mensagem e botão</span>
            </div>

            {content.promoBar.visible && (
              <>
                {/* Preview */}
                <div
                  className="flex items-center justify-between gap-4 rounded-md px-4 py-2.5 text-sm font-medium"
                  style={{ background: content.promoBar.bgColor, color: content.promoBar.textColor }}
                >
                  <span>{content.promoBar.text || "Texto da barra promocional"}</span>
                  {content.promoBar.btnText && (
                    <span className="flex-none rounded border border-white/30 px-3 py-1 text-xs font-bold">
                      {content.promoBar.btnText}
                    </span>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Texto" hint="Emojis são permitidos">
                    <input value={content.promoBar.text} onChange={(e) => setPromoBar({ text: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="URL do botão">
                    <input value={content.promoBar.btnUrl} onChange={(e) => setPromoBar({ btnUrl: e.target.value })} placeholder="#colecao ou /produtos" className={inputCls} />
                  </Field>
                  <Field label="Texto do botão (opcional)">
                    <input value={content.promoBar.btnText} onChange={(e) => setPromoBar({ btnText: e.target.value })} placeholder="Aproveitar" className={inputCls} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Cor de fundo">
                      <div className="flex gap-2">
                        <input type="color" value={content.promoBar.bgColor} onChange={(e) => setPromoBar({ bgColor: e.target.value })} className="h-10 w-12 cursor-pointer rounded border border-border bg-transparent" />
                        <input value={content.promoBar.bgColor} onChange={(e) => setPromoBar({ bgColor: e.target.value })} className={inputCls} />
                      </div>
                    </Field>
                    <Field label="Cor do texto">
                      <div className="flex gap-2">
                        <input type="color" value={content.promoBar.textColor} onChange={(e) => setPromoBar({ textColor: e.target.value })} className="h-10 w-12 cursor-pointer rounded border border-border bg-transparent" />
                        <input value={content.promoBar.textColor} onChange={(e) => setPromoBar({ textColor: e.target.value })} className={inputCls} />
                      </div>
                    </Field>
                  </div>
                </div>
              </>
            )}
          </Section>

          {/* ── Hero ── */}
          <Section title="🖼️ Hero Banner — Destaque principal da loja" defaultOpen={true}>
            <p className="text-xs text-muted-foreground -mt-1 mb-2">
              Gerencie a imagem principal, o título com destaque neon, badge e botões de chamada para ação.
            </p>

            {/* ── PRÉ-VISUALIZAÇÃO AO VIVO (Réplica exata da loja) ── */}
            <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-b from-background via-background to-secondary/30 p-6 md:p-8 shadow-inner">
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-neon" />
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Pré-visualização em Tempo Real (Como os clientes veem)
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground hidden sm:inline">
                  Atualização instantânea
                </span>
              </div>

              <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
                <div>
                  {content.hero.badge && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-neon/40 bg-neon/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-neon">
                      <Sparkles className="h-3 w-3" /> {content.hero.badge}
                    </span>
                  )}
                  <h2 className="mt-4 font-display text-3xl font-bold leading-tight md:text-5xl tracking-tight">
                    {content.hero.headingPre}{content.hero.headingPre ? " " : ""}
                    <span className="neon-text text-neon">{content.hero.headingHighlight}</span>
                    {content.hero.headingPost.split("\\n").map((part, i) =>
                      i === 0 ? part : <><br key={i} />{part}</>
                    )}
                  </h2>
                  <p className="mt-4 text-sm text-muted-foreground max-w-md leading-relaxed">
                    {content.hero.description || "Descrição do seu negócio e proposta de valor."}
                  </p>
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    {content.hero.primaryBtnText && (
                      <span className="inline-flex items-center gap-2 rounded-md bg-neon px-5 py-2.5 font-display text-xs font-bold text-primary-foreground shadow-lg shadow-neon/20">
                        {content.hero.primaryBtnText} <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    )}
                    {content.hero.secondaryBtnText && (
                      <span className="inline-flex items-center rounded-md border border-border bg-card/60 px-5 py-2.5 font-display text-xs font-semibold text-foreground">
                        {content.hero.secondaryBtnText}
                      </span>
                    )}
                  </div>
                </div>

                {/* Imagem do Hero */}
                <div className="relative">
                  <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-tr from-card to-secondary/30 p-2 shadow-2xl">
                    <img
                      src={content.hero.imageUrl || heroImg}
                      alt={content.hero.imageAlt || "Hero"}
                      className="aspect-[4/3] w-full rounded-xl object-cover"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── UPLOAD DA IMAGEM DO HERO ── */}
            <div className="rounded-lg border border-border/70 bg-card/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-neon" />
                    Imagem Principal do Hero
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Faça upload da imagem de destaque da sua loja (PNG, JPG, WebP de alta resolução).
                  </p>
                </div>

                {content.hero.imageUrl && (
                  <button
                    type="button"
                    onClick={() => setHero({ imageUrl: "" })}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition cursor-pointer"
                    title="Voltar para a imagem padrão"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Restaurar imagem padrão
                  </button>
                )}
              </div>

              <div
                onClick={() => heroFileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) handleHeroUpload(e.dataTransfer.files[0]);
                }}
                className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition cursor-pointer ${
                  uploadingHero
                    ? "border-neon bg-neon/5 opacity-80"
                    : "border-border hover:border-neon hover:bg-secondary/30"
                }`}
              >
                {uploadingHero ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin text-neon mb-2" />
                    <p className="text-sm font-semibold">Fazendo upload da imagem do hero...</p>
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-6 w-6 text-neon mb-2" />
                    <p className="text-sm font-semibold">
                      Clique para selecionar ou arraste uma nova imagem para o Hero
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {content.hero.imageUrl
                        ? "Uma imagem customizada está ativa. Clique para substituir."
                        : "Atualmente usando a imagem padrão. Clique para trocar."}
                    </p>
                  </>
                )}
              </div>

              <input
                ref={heroFileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleHeroUpload(e.target.files[0]);
                }}
              />

              <div className="grid gap-3 sm:grid-cols-2 pt-1">
                <Field label="URL da imagem (opcional/alternativa)" hint="Ou cole diretamente o link de uma imagem externa">
                  <input
                    value={content.hero.imageUrl}
                    onChange={(e) => setHero({ imageUrl: e.target.value })}
                    placeholder="https://..."
                    className={inputCls}
                  />
                </Field>
                <Field label="Texto Alternativo (Alt / SEO)" hint="Descreva a imagem para o Google">
                  <input
                    value={content.hero.imageAlt}
                    onChange={(e) => setHero({ imageAlt: e.target.value })}
                    placeholder="Ex: Stop Notebooks - Loja Online"
                    className={inputCls}
                  />
                </Field>
              </div>
            </div>

            {/* ── TEXTOS E CHAMADAS ── */}
            <div className="space-y-3 pt-2">
              <h4 className="font-semibold text-sm">Textos e Chamadas do Título</h4>

              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Badge (etiqueta acima do título)" hint="Ex: 'NOVIDADES 2026'">
                  <input
                    value={content.hero.badge}
                    onChange={(e) => setHero({ badge: e.target.value })}
                    placeholder="NOVIDADES 2026"
                    className={inputCls}
                  />
                </Field>
                <Field label="Texto antes do destaque" hint="Ex: 'Prazer com'">
                  <input
                    value={content.hero.headingPre}
                    onChange={(e) => setHero({ headingPre: e.target.value })}
                    placeholder="Prazer com"
                    className={inputCls}
                  />
                </Field>
                <Field label="Palavra em destaque (Neon)" hint="Ficará verde com brilho neon">
                  <input
                    value={content.hero.headingHighlight}
                    onChange={(e) => setHero({ headingHighlight: e.target.value })}
                    placeholder="discrição"
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field
                label="Texto após o destaque"
                hint="Use \n para quebrar linha. Ex: '.\nEntrega sigilosa.'"
              >
                <input
                  value={content.hero.headingPost}
                  onChange={(e) => setHero({ headingPost: e.target.value })}
                  placeholder=".\nEntrega sigilosa."
                  className={inputCls}
                />
              </Field>

              <Field label="Descrição detalhada">
                <textarea
                  value={content.hero.description}
                  onChange={(e) => setHero({ description: e.target.value })}
                  rows={3}
                  className={textareaCls}
                />
              </Field>
            </div>

            {/* ── BOTÕES DE AÇÃO ── */}
            <div className="space-y-3 pt-2">
              <h4 className="font-semibold text-sm">Botões de Ação (CTAs)</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Botão principal — Texto">
                  <input
                    value={content.hero.primaryBtnText}
                    onChange={(e) => setHero({ primaryBtnText: e.target.value })}
                    placeholder="VER PRODUTOS"
                    className={inputCls}
                  />
                </Field>
                <Field label="Botão principal — Link / URL">
                  <input
                    value={content.hero.primaryBtnUrl}
                    onChange={(e) => setHero({ primaryBtnUrl: e.target.value })}
                    placeholder="#colecao"
                    className={inputCls}
                  />
                </Field>
                <Field label="Botão secundário — Texto">
                  <input
                    value={content.hero.secondaryBtnText}
                    onChange={(e) => setHero({ secondaryBtnText: e.target.value })}
                    placeholder="Mais vendidos"
                    className={inputCls}
                  />
                </Field>
                <Field label="Botão secundário — Link / URL">
                  <input
                    value={content.hero.secondaryBtnUrl}
                    onChange={(e) => setHero({ secondaryBtnUrl: e.target.value })}
                    placeholder="#bestsellers"
                    className={inputCls}
                  />
                </Field>
              </div>
            </div>
          </Section>

          {/* ── Trust Badges ── */}
          <Section title="✅ Ícones de confiança (abaixo dos botões)">
            <p className="text-xs text-muted-foreground">Itens exibidos abaixo dos botões do hero: frete grátis, segurança, etc.</p>
            <div className="space-y-3">
              {content.trustBadges.map((badge, i) => {
                const IconComp = getIcon(badge.icon);
                return (
                  <div key={i} className="flex items-center gap-3 rounded-md border border-border p-3">
                    <IconComp className="h-5 w-5 flex-none text-neon" />
                    <select
                      value={badge.icon}
                      onChange={(e) => {
                        const updated = [...content.trustBadges];
                        updated[i] = { ...updated[i], icon: e.target.value as TrustBadgeIcon };
                        set("trustBadges", updated);
                      }}
                      className="h-9 rounded-md border border-border bg-background/50 px-2 text-xs"
                    >
                      {ICON_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>{o.label}</option>
                      ))}
                    </select>
                    <input
                      value={badge.text}
                      onChange={(e) => {
                        const updated = [...content.trustBadges];
                        updated[i] = { ...updated[i], text: e.target.value };
                        set("trustBadges", updated);
                      }}
                      placeholder="Frete grátis acima de R$149"
                      className={inputCls + " flex-1"}
                    />
                    <button
                      type="button"
                      onClick={() => set("trustBadges", content.trustBadges.filter((_, idx) => idx !== i))}
                      className="flex-none text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => set("trustBadges", [...content.trustBadges, { icon: "truck", text: "" }])}
                className="flex items-center gap-2 text-sm text-neon hover:underline"
              >
                <Plus className="h-4 w-4" /> Adicionar ícone
              </button>
            </div>
          </Section>

          {/* ── Seções de produtos ── */}
          <Section title="📦 Seções de produtos">
            {(
              [
                { key: "collection", label: "Coleção completa" },
                { key: "bestsellers", label: "Mais vendidos" },
                { key: "novidades", label: "Novidades" },
              ] as const
            ).map(({ key, label }) => {
              const sec = content.sections[key];
              return (
                <div key={key} className="rounded-md border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{label}</p>
                    <button
                      type="button"
                      onClick={() => setSections({ [key]: { ...sec, visible: !sec.visible } })}
                      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                        sec.visible
                          ? "border-neon bg-neon/10 text-neon"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {sec.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {sec.visible ? "Visível" : "Oculto"}
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Eyebrow (texto pequeno acima do título)">
                      <input
                        value={sec.eyebrow}
                        onChange={(e) => setSections({ [key]: { ...sec, eyebrow: e.target.value } })}
                        placeholder="Catálogo"
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Título da seção">
                      <input
                        value={sec.title}
                        onChange={(e) => setSections({ [key]: { ...sec, title: e.target.value } })}
                        placeholder="A coleção completa"
                        className={inputCls}
                      />
                    </Field>
                  </div>
                </div>
              );
            })}
          </Section>

          {/* ── Categorias ── */}
          <Section title="🗂️ Categorias (seção de cards clicáveis)" defaultOpen={false}>
            <p className="text-xs text-muted-foreground">
              Cards visuais que filtram os produtos por categoria. Aparecem entre os banners e a coleção.
              Use o mesmo texto que está no campo "Categoria" dos produtos.
            </p>
            <div className="space-y-3">
              {content.categories.map((cat, i) => (
                <div key={i} className="rounded-md border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {cat.imageUrl && (
                        <img src={cat.imageUrl} alt="" className="h-8 w-8 rounded object-cover" />
                      )}
                      <span className="text-sm font-semibold">{cat.name || `Categoria ${i + 1}`}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...content.categories];
                          updated[i] = { ...updated[i], visible: !updated[i].visible };
                          set("categories", updated);
                        }}
                        className={`rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors ${
                          cat.visible ? "border-neon bg-neon/10 text-neon" : "border-border text-muted-foreground"
                        }`}
                      >
                        {cat.visible ? "Visível" : "Oculto"}
                      </button>
                      <button
                        type="button"
                        onClick={() => set("categories", content.categories.filter((_, idx) => idx !== i))}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Nome do card">
                      <input
                        value={cat.name}
                        onChange={(e) => {
                          const updated = [...content.categories];
                          updated[i] = { ...updated[i], name: e.target.value };
                          set("categories", updated);
                        }}
                        placeholder="Amadeirado"
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Filtro (valor da categoria)" hint="Deve bater com o campo 'Categoria' do produto">
                      <input
                        value={cat.filterCategory}
                        onChange={(e) => {
                          const updated = [...content.categories];
                          updated[i] = { ...updated[i], filterCategory: e.target.value };
                          set("categories", updated);
                        }}
                        placeholder="Amadeirado"
                        className={inputCls}
                      />
                    </Field>
                    <Field label="URL da imagem do card">
                      <input
                        value={cat.imageUrl}
                        onChange={(e) => {
                          const updated = [...content.categories];
                          updated[i] = { ...updated[i], imageUrl: e.target.value };
                          set("categories", updated);
                        }}
                        placeholder="https://..."
                        className={inputCls}
                      />
                    </Field>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  set("categories", [
                    ...content.categories,
                    { name: "", imageUrl: "", filterCategory: "", visible: true },
                  ])
                }
                className="flex items-center gap-2 text-sm text-neon hover:underline"
              >
                <Plus className="h-4 w-4" /> Adicionar categoria
              </button>
            </div>
          </Section>

          {/* ── Save ── */}
          <div className="sticky bottom-4 flex justify-end">
            <button
              type="submit"
              disabled={saveMut.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-neon px-6 py-3 text-sm font-bold text-primary-foreground glow transition-transform hover:scale-[1.01] disabled:opacity-50 disabled:scale-100 shadow-lg"
            >
              {saveMut.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</>
                : <><Save className="h-4 w-4" /> Salvar página inicial</>}
            </button>
          </div>
        </form>
      )}
    </AdminLayout>
  );
}

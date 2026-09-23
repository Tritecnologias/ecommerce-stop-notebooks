import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  Pencil,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Sun,
  Moon,
  Grid,
  Sparkles,
  Sliders,
  AlertCircle,
  Eye,
  UploadCloud,
  Check,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  getLogos,
  createLogo,
  updateLogo,
  deleteLogo,
  toggleLogoActive,
  type StoreLogo,
  type LogoPlacement,
} from "@/fns/logos";
import { getLogoUploadUrl } from "@/fns/storage";
import { AdminLayout } from "@/routes/admin/index";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { STORE } from "@/lib/store";

export const Route = createFileRoute("/admin/logotipos/")({
  head: () => ({ meta: [{ title: "Gerenciar Logotipos — Admin Secret Desire" }] }),
  component: AdminLogosPage,
});

const PLACEMENT_LABELS: Record<LogoPlacement, { label: string; desc: string; badgeCls: string }> = {
  header: {
    label: "Cabeçalho",
    desc: "Exibido no topo principal do site",
    badgeCls: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  footer: {
    label: "Rodapé",
    desc: "Exibido na seção inferior da loja",
    badgeCls: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  },
  all: {
    label: "Geral (Cabeçalho e Rodapé)",
    desc: "Aplicado tanto no topo quanto no rodapé",
    badgeCls: "bg-neon/10 text-neon border-neon/30",
  },
  admin: {
    label: "Painel Admin",
    desc: "Exibido no topo do menu lateral admin",
    badgeCls: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  favicon: {
    label: "Favicon",
    desc: "Ícone na aba do navegador",
    badgeCls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
};

type ContrastBg = "dark" | "light" | "grid";

export function AdminLogosPage() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading) {
      if (!user) navigate({ to: "/login" });
      else if (profile && profile.role !== "admin") navigate({ to: "/" });
    }
  }, [user, profile, loading, navigate]);

  // Busca todos os logotipos
  const { data: logos = [], isLoading } = useQuery({
    queryKey: ["admin-logos"],
    queryFn: () => getLogos(),
    enabled: !!user && profile?.role === "admin",
  });

  // Modais
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLogo, setEditingLogo] = useState<StoreLogo | null>(null);
  const [deletingLogo, setDeletingLogo] = useState<StoreLogo | null>(null);

  // Estados do formulário de upload / edição
  const [formName, setFormName] = useState("");
  const [formPlacement, setFormPlacement] = useState<LogoPlacement>("header");
  const [formHeight, setFormHeight] = useState<number>(40);
  const [formAltText, setFormAltText] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formUrl, setFormUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [contrastPreview, setContrastPreview] = useState<Record<string, ContrastBg>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reseta form ao abrir
  const openNewLogoModal = () => {
    setEditingLogo(null);
    setFormName("");
    setFormPlacement("header");
    setFormHeight(40);
    setFormAltText("");
    setFormActive(true);
    setFormUrl("");
    setUploadProgress(null);
    setModalOpen(true);
  };

  const openEditModal = (logo: StoreLogo) => {
    setEditingLogo(logo);
    setFormName(logo.name);
    setFormPlacement(logo.placement);
    setFormHeight(logo.height || 40);
    setFormAltText(logo.alt_text || "");
    setFormActive(logo.active);
    setFormUrl(logo.url);
    setUploadProgress(null);
    setModalOpen(true);
  };

  // Upload handler
  const handleFileUpload = async (file: File) => {
    const accepted = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif", "image/avif", "image/x-icon", "image/vnd.microsoft.icon"];
    if (!accepted.includes(file.type) && !file.name.endsWith(".svg") && !file.name.endsWith(".ico")) {
      toast.error("Formato inválido. Use PNG, SVG, WebP, JPG ou ICO.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("O arquivo excede o limite de 5MB.");
      return;
    }

    setUploading(true);
    setUploadProgress("Gerando link seguro de envio...");

    try {
      const { uploadUrl, publicUrl } = await getLogoUploadUrl({
        data: {
          fileName: file.name,
          contentType: file.type || "image/png",
        },
      });

      setUploadProgress("Fazendo upload da imagem...");

      const res = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "image/png" },
      });

      if (!res.ok) {
        throw new Error(`Falha no upload (Status ${res.status})`);
      }

      setFormUrl(publicUrl);
      if (!formName) {
        // Sugere o nome baseado no arquivo
        const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        setFormName(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
      }
      toast.success("Imagem enviada com sucesso!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar arquivo.");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  // Mutations
  const createMut = useMutation({
    mutationFn: (data: {
      name: string;
      url: string;
      placement: LogoPlacement;
      active: boolean;
      height: number;
      alt_text: string;
    }) => createLogo({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-logos"] });
      qc.invalidateQueries({ queryKey: ["active-logos"] });
      toast.success("Logotipo cadastrado com sucesso!");
      setModalOpen(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao cadastrar logotipo"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<StoreLogo> }) =>
      updateLogo({ data: { id, data } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-logos"] });
      qc.invalidateQueries({ queryKey: ["active-logos"] });
      toast.success("Logotipo atualizado!");
      setModalOpen(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao atualizar logotipo"),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      toggleLogoActive({ data: { id, active } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-logos"] });
      qc.invalidateQueries({ queryKey: ["active-logos"] });
      toast.success("Status do logotipo atualizado!");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao alterar status"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteLogo({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-logos"] });
      qc.invalidateQueries({ queryKey: ["active-logos"] });
      toast.success("Logotipo excluído com sucesso!");
      setDeletingLogo(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao excluir logotipo"),
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUrl) {
      toast.error("Por favor, faça upload de uma imagem para o logotipo.");
      return;
    }
    if (!formName.trim()) {
      toast.error("Informe um nome para identificar este logotipo.");
      return;
    }

    if (editingLogo) {
      updateMut.mutate({
        id: editingLogo.id,
        data: {
          name: formName,
          url: formUrl,
          placement: formPlacement,
          height: formHeight,
          alt_text: formAltText,
          active: formActive,
        },
      });
    } else {
      createMut.mutate({
        name: formName,
        url: formUrl,
        placement: formPlacement,
        height: formHeight,
        alt_text: formAltText,
        active: formActive,
      });
    }
  };

  const activeHeader = logos.find((l) => l.active && (l.placement === "header" || l.placement === "all"));
  const activeFooter = logos.find((l) => l.active && (l.placement === "footer" || l.placement === "all"));
  const activeFavicon = logos.find((l) => l.active && l.placement === "favicon");

  if (loading || !profile) return null;

  return (
    <AdminLayout title="Identidade Visual & Logotipos">
      {/* ── Top Header ────────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Gerencie os logotipos da sua loja para o cabeçalho, rodapé, favicon e painel admin.
          </p>
        </div>
        <button
          onClick={openNewLogoModal}
          className="inline-flex items-center gap-2 rounded-md bg-neon px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-neon/90 transition shadow-lg shadow-neon/20 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Novo Logotipo
        </button>
      </div>

      {/* ── Status / Metrics Bar ────────────────────────────────────────────── */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Total Cadastrados</span>
            <ImageIcon className="h-4 w-4 text-neon" />
          </div>
          <p className="font-display text-2xl font-bold">{logos.length}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Imagens no storage</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Cabeçalho Ativo</span>
            <span className={`h-2 w-2 rounded-full ${activeHeader ? "bg-neon glow" : "bg-muted-foreground"}`} />
          </div>
          <p className="font-display text-base font-semibold truncate">
            {activeHeader ? activeHeader.name : "Padrão (Texto)"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {activeHeader ? `Altura: ${activeHeader.height}px` : "Nome da loja em texto"}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Rodapé Ativo</span>
            <span className={`h-2 w-2 rounded-full ${activeFooter ? "bg-purple-400 glow" : "bg-muted-foreground"}`} />
          </div>
          <p className="font-display text-base font-semibold truncate">
            {activeFooter ? activeFooter.name : "Padrão (Texto)"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {activeFooter ? `Altura: ${activeFooter.height}px` : "Nome da loja em texto"}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Favicon da Aba</span>
            <span className={`h-2 w-2 rounded-full ${activeFavicon ? "bg-emerald-400 glow" : "bg-muted-foreground"}`} />
          </div>
          <p className="font-display text-base font-semibold truncate">
            {activeFavicon ? activeFavicon.name : "Padrão"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">Ícone no navegador</p>
        </div>
      </div>

      {/* ── Lista de Logotipos (CRUD) ────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-neon mb-3" />
          <p className="text-sm text-muted-foreground">Carregando logotipos...</p>
        </div>
      ) : logos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary/80 text-neon mb-4">
            <UploadCloud className="h-7 w-7" />
          </div>
          <h3 className="font-display text-lg font-bold">Nenhum logotipo cadastrado</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
            Faça o upload do primeiro logotipo da sua loja (em formato PNG com fundo transparente ou SVG) para personalizar o cabeçalho e rodapé.
          </p>
          <button
            onClick={openNewLogoModal}
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-neon px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-neon/90 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Cadastrar Primeiro Logotipo
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {logos.map((logo) => {
              const contrast = contrastPreview[logo.id] || "dark";
              const placementInfo = PLACEMENT_LABELS[logo.placement] || PLACEMENT_LABELS.header;

              return (
                <div
                  key={logo.id}
                  className={`group relative flex flex-col rounded-xl border transition-all ${
                    logo.active
                      ? "border-neon/50 bg-card shadow-lg shadow-neon/5 ring-1 ring-neon/30"
                      : "border-border bg-card hover:border-border/80"
                  }`}
                >
                  {/* Cabeçalho do Card */}
                  <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${placementInfo.badgeCls}`}
                      >
                        {placementInfo.label}
                      </span>
                      {logo.active ? (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-neon">
                          <CheckCircle2 className="h-3 w-3" /> Ativo
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Inativo</span>
                      )}
                    </div>

                    {/* Seletor de contraste da prévia */}
                    <div className="flex items-center gap-1 rounded bg-secondary/80 p-0.5">
                      <button
                        title="Fundo escuro"
                        onClick={() =>
                          setContrastPreview((prev) => ({ ...prev, [logo.id]: "dark" }))
                        }
                        className={`p-1 rounded text-xs transition ${
                          contrast === "dark" ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Moon className="h-3 w-3" />
                      </button>
                      <button
                        title="Fundo claro"
                        onClick={() =>
                          setContrastPreview((prev) => ({ ...prev, [logo.id]: "light" }))
                        }
                        className={`p-1 rounded text-xs transition ${
                          contrast === "light" ? "bg-white text-black shadow" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Sun className="h-3 w-3" />
                      </button>
                      <button
                        title="Fundo quadriculado (transparência)"
                        onClick={() =>
                          setContrastPreview((prev) => ({ ...prev, [logo.id]: "grid" }))
                        }
                        className={`p-1 rounded text-xs transition ${
                          contrast === "grid" ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Grid className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Área de Visualização da Imagem */}
                  <div
                    className={`flex min-h-48 h-auto items-center justify-center p-6 relative overflow-hidden transition-colors ${
                      contrast === "light"
                        ? "bg-neutral-100"
                        : contrast === "grid"
                        ? "bg-[radial-gradient(#333_1px,transparent_1px)] [background-size:12px_12px] bg-secondary/30"
                        : "bg-background/90"
                    }`}
                  >
                    <img
                      src={logo.url}
                      alt={logo.alt_text || logo.name}
                      style={{ maxHeight: `${Math.min(logo.height || 40, 180)}px` }}
                      className="max-w-full object-contain transition-transform group-hover:scale-105 duration-200"
                    />
                  </div>

                  {/* Informações do Logotipo */}
                  <div className="flex-1 p-4">
                    <h4 className="font-display font-bold text-base truncate" title={logo.name}>
                      {logo.name}
                    </h4>
                    {logo.alt_text && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5" title={logo.alt_text}>
                        Alt: "{logo.alt_text}"
                      </p>
                    )}
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border/40 pt-2.5">
                      <span>Altura: <strong className="text-foreground">{logo.height}px</strong></span>
                      <span>{new Date(logo.created_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>

                  {/* Ações do Card */}
                  <div className="flex items-center justify-between border-t border-border/60 bg-secondary/20 px-4 py-2.5">
                    {/* Toggle Ativo */}
                    <button
                      onClick={() => toggleMut.mutate({ id: logo.id, active: !logo.active })}
                      disabled={toggleMut.isPending}
                      className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                        logo.active
                          ? "bg-neon/15 text-neon hover:bg-neon/25"
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {logo.active ? (
                        <>
                          <Check className="h-3 w-3" /> Ativado
                        </>
                      ) : (
                        "Ativar na loja"
                      )}
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(logo)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition cursor-pointer"
                        title="Editar configurações deste logotipo"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeletingLogo(logo)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition cursor-pointer"
                        title="Excluir logotipo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Simulador ao Vivo do Cabeçalho e Rodapé ───────────────────────── */}
          <div className="mt-12 rounded-xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-neon" />
                  Simulador de Aplicação em Tempo Real
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Veja como sua loja está sendo exibida para os clientes neste momento.
                </p>
              </div>
              <Link
                to="/"
                target="_blank"
                className="inline-flex items-center gap-1 text-xs font-semibold text-neon hover:underline"
              >
                Abrir loja <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Simulação do Cabeçalho */}
            <div className="space-y-4">
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Prévia no Cabeçalho
                </span>
                <div className="rounded-lg border border-border/80 bg-background/80 backdrop-blur px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {activeHeader ? (
                      <img
                        src={activeHeader.url}
                        alt={activeHeader.alt_text || STORE.name}
                        style={{ maxHeight: `${activeHeader.height}px` }}
                        className="object-contain"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-neon glow animate-pulse-glow" />
                        <span className="font-display text-lg font-bold tracking-tight">
                          {STORE.name.toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Produtos</span>
                    <span>Mais vendidos</span>
                    <span>Monte seu Kit</span>
                  </div>
                </div>
              </div>

              {/* Simulação do Rodapé */}
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Prévia no Rodapé
                </span>
                <div className="rounded-lg border border-border/80 bg-card/60 px-6 py-5 flex items-center justify-between">
                  <div>
                    {activeFooter ? (
                      <img
                        src={activeFooter.url}
                        alt={activeFooter.alt_text || STORE.name}
                        style={{ maxHeight: `${activeFooter.height}px` }}
                        className="object-contain"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-neon glow" />
                        <span className="font-display text-lg font-bold">{STORE.name.toUpperCase()}</span>
                      </div>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">{STORE.tagline}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de Cadastro / Edição ───────────────────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold">
              {editingLogo ? "Editar Logotipo" : "Cadastrar Novo Logotipo"}
            </DialogTitle>
            <DialogDescription>
              {editingLogo
                ? "Atualize o nome, posição, altura e imagem do logotipo."
                : "Faça upload da imagem do logotipo e configure onde ele será aplicado."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-5 pt-2">
            {/* Upload Drag & Drop Area */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Arquivo do Logotipo
              </label>

              {formUrl ? (
                <div className="rounded-lg border border-border bg-secondary/30 p-4">
                  <div className="flex items-center justify-center p-4 bg-background/80 rounded border border-border/40 min-h-[140px] max-h-[260px] overflow-hidden mb-3">
                    <img
                      src={formUrl}
                      alt="Prévia do logotipo"
                      style={{ maxHeight: `${Math.min(formHeight, 220)}px` }}
                      className="object-contain w-auto transition-all"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Imagem carregada</span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="text-xs font-semibold text-neon hover:underline cursor-pointer"
                    >
                      Trocar imagem
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0]);
                  }}
                  className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition cursor-pointer ${
                    uploading
                      ? "border-neon bg-neon/5 opacity-80"
                      : "border-border hover:border-neon hover:bg-secondary/20"
                  }`}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-8 w-8 animate-spin text-neon mb-2" />
                      <p className="text-sm font-semibold">{uploadProgress || "Enviando imagem..."}</p>
                    </>
                  ) : (
                    <>
                      <div className="rounded-full bg-secondary p-3 text-neon mb-3">
                        <UploadCloud className="h-6 w-6" />
                      </div>
                      <p className="text-sm font-semibold">
                        Clique para selecionar ou arraste uma imagem aqui
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        PNG (com transparência), SVG, WebP, JPG ou ICO (máx. 5MB)
                      </p>
                    </>
                  )}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif,image/avif,image/x-icon"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
                }}
              />
            </div>

            {/* Nome do Logotipo */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Nome do Logotipo *
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Logo Principal Escuro, Logo Rodapé, Stop Notebooks Horizontal"
                className="h-10 w-full rounded-md border border-border bg-background/50 px-3 text-sm placeholder:text-muted-foreground focus:border-neon focus:outline-none focus:ring-1 focus:ring-neon transition"
              />
            </div>

            {/* Aplicação / Placement */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Aplicação / Onde Exibir
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(Object.keys(PLACEMENT_LABELS) as LogoPlacement[]).map((key) => {
                  const info = PLACEMENT_LABELS[key];
                  const selected = formPlacement === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFormPlacement(key)}
                      className={`flex flex-col text-left p-3 rounded-lg border transition cursor-pointer ${
                        selected
                          ? "border-neon bg-neon/10 text-foreground ring-1 ring-neon/40"
                          : "border-border bg-card/40 text-muted-foreground hover:bg-secondary/40"
                      }`}
                    >
                      <span className="font-semibold text-xs text-foreground flex items-center justify-between">
                        {info.label}
                        {selected && <Check className="h-3.5 w-3.5 text-neon" />}
                      </span>
                      <span className="text-[11px] text-muted-foreground mt-0.5">{info.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Altura de Exibição */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Altura de Exibição (px)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={16}
                    max={250}
                    value={formHeight}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!isNaN(val)) setFormHeight(Math.max(16, Math.min(250, val)));
                    }}
                    className="w-16 h-7 rounded border border-border bg-background px-2 text-center text-xs font-mono font-bold text-neon focus:border-neon focus:outline-none"
                  />
                  <span className="text-xs text-muted-foreground font-mono">px</span>
                </div>
              </div>
              <input
                type="range"
                min={20}
                max={220}
                step={2}
                value={formHeight}
                onChange={(e) => setFormHeight(Number(e.target.value))}
                className="w-full accent-neon cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>Discreto (20px)</span>
                <span>Padrão (48px)</span>
                <span>Médio (90px)</span>
                <span>Grande (140px)</span>
                <span>Destaque (220px)</span>
              </div>

              {/* Botões rápidos de altura */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                <span className="text-[11px] text-muted-foreground mr-1">Atalhos rápidos:</span>
                {[36, 48, 64, 90, 120, 160, 200].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setFormHeight(h)}
                    className={`rounded px-2 py-0.5 text-[11px] font-mono transition cursor-pointer ${
                      formHeight === h
                        ? "bg-neon text-primary-foreground font-bold"
                        : "bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    {h}px
                  </button>
                ))}
              </div>
            </div>

            {/* Texto Alternativo (Alt Text) */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Texto Alternativo (Alt / Acessibilidade e SEO)
              </label>
              <input
                type="text"
                value={formAltText}
                onChange={(e) => setFormAltText(e.target.value)}
                placeholder={`Ex: ${STORE.name} - Loja Online`}
                className="h-10 w-full rounded-md border border-border bg-background/50 px-3 text-sm placeholder:text-muted-foreground focus:border-neon focus:outline-none focus:ring-1 focus:ring-neon transition"
              />
            </div>

            {/* Tornar Ativo */}
            <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-secondary/30 p-3.5">
              <input
                id="active-checkbox"
                type="checkbox"
                checked={formActive}
                onChange={(e) => setFormActive(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-neon cursor-pointer"
              />
              <label htmlFor="active-checkbox" className="text-sm cursor-pointer select-none">
                <strong className="block font-medium">Definir como logotipo ativo</strong>
                <span className="text-xs text-muted-foreground">
                  Substituirá qualquer outro logotipo ativo para esta mesma posição na loja.
                </span>
              </label>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={createMut.isPending || updateMut.isPending || uploading || !formUrl}
                className="inline-flex items-center gap-2 rounded-md bg-neon px-5 py-2 text-sm font-bold text-primary-foreground hover:bg-neon/90 transition disabled:opacity-50 cursor-pointer"
              >
                {(createMut.isPending || updateMut.isPending) && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {editingLogo ? "Salvar Alterações" : "Salvar Logotipo"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Confirmação de Exclusão ─────────────────────────────────────────── */}
      <AlertDialog open={!!deletingLogo} onOpenChange={(open) => !open && setDeletingLogo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Logotipo?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza de que deseja excluir o logotipo <strong>"{deletingLogo?.name}"</strong>? O arquivo será removido do sistema.
              {deletingLogo?.active && (
                <span className="block mt-2 text-yellow-400 font-semibold">
                  Atenção: este logotipo está ativo no momento. Ao excluí-lo, a loja voltará a exibir o nome padrão em texto.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingLogo && deleteMut.mutate(deletingLogo.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sim, Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}

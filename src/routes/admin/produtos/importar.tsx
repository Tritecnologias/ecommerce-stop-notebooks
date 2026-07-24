import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import Papa from "papaparse";
import {
  Upload, ArrowLeft, AlertTriangle, CheckCircle2,
  Package, Loader2, X, RefreshCw,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { batchImportProducts } from "@/fns/products";
import { AdminLayout } from "@/routes/admin/index";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = "idle" | "parsing" | "preview" | "importing" | "done";

type ProductRow = {
  slug: string;
  name: string;
  short_description: string | null;
  description: string | null;
  price: number;
  old_price: number | null;
  category: string | null;
  tag: null;
  notes: string[];
  sizes: string[];
  images: string[];
  rating: number;
  review_count: number;
  stock: number;
  active: boolean;
  meta_title: string | null;
  meta_description: string | null;
  og_image: string | null;
};

// ─── Helpers de transformação ────────────────────────────────────────────────

function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || null;
}

function extractCategory(categories: string[]): string | null {
  if (!categories.length) return null;
  const deepest = categories.reduce((a, b) =>
    b.split("/").length > a.split("/").length ? b : a, categories[0]);
  return deepest.split("/").pop()?.trim() || null;
}

function toSlug(urlKey: string, name: string, sku: string): string {
  const base =
    urlKey?.trim() ||
    name?.trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-") ||
    sku.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return base
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseMagentoRows(
  rows: Record<string, string>[],
  imageBase: string,
): { products: ProductRow[]; skipped: number } {
  // Agrupa linhas por SKU (linhas sem SKU são continuações com categoria/imagem extras)
  const productMap = new Map<
    string,
    Record<string, string> & { _categories: string[]; _images: string[] }
  >();
  let currentSku: string | null = null;

  for (const row of rows) {
    const sku = row.sku?.trim();
    if (sku) {
      currentSku = sku;
      const categories = row._category?.trim() ? [row._category.trim()] : [];
      const images = row._media_image?.trim() ? [row._media_image.trim()] : [];
      productMap.set(sku, { ...row, _categories: categories, _images: images });
    } else if (currentSku && productMap.has(currentSku)) {
      const p = productMap.get(currentSku)!;
      if (row._category?.trim()) p._categories.push(row._category.trim());
      if (row._media_image?.trim()) {
        const img = row._media_image.trim();
        if (!p._images.includes(img)) p._images.push(img);
      }
    }
  }

  const products: ProductRow[] = [];
  let skipped = 0;

  for (const [sku, row] of productMap) {
    const type = row._type?.toLowerCase().trim();
    if (type && type !== "simple") { skipped++; continue; }

    const price = parseFloat(row.price) || 0;
    if (price <= 0) { skipped++; continue; }

    const specialPrice = parseFloat(row.special_price) || 0;
    const finalPrice = specialPrice > 0 ? specialPrice : price;
    const oldPrice = specialPrice > 0 ? price : null;

    const stock = Math.max(0, Math.round(parseFloat(row.qty) || 0));
    const active = row.status === "1";

    const slug = toSlug(row.url_key, row.name, sku);
    if (!slug || !row.name?.trim()) { skipped++; continue; }

    const images = row._images
      .map((img) => (imageBase.trim() ? `${imageBase.trim()}${img}` : img))
      .filter(Boolean);

    products.push({
      slug,
      name: row.name.trim(),
      short_description: stripHtml(row.short_description),
      description: row.description?.trim() || null,
      price: finalPrice,
      old_price: oldPrice,
      category: extractCategory(row._categories),
      tag: null,
      notes: [],
      sizes: [],
      images,
      rating: 0,
      review_count: 0,
      stock,
      active,
      meta_title: row.meta_title?.trim() || null,
      meta_description: row.meta_description?.trim() || null,
      og_image: images[0] || null,
    });
  }

  return { products, skipped };
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const BATCH_SIZE = 100;

// ─── Rota ─────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/admin/produtos/importar")({
  head: () => ({ meta: [{ title: "Importar CSV — Admin" }] }),
  component: ImportPage,
});

// ─── Componente principal ─────────────────────────────────────────────────────

function ImportPage() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  const [stage, setStage] = useState<Stage>("idle");
  const [imageBase, setImageBase] = useState("");
  const [fileName, setFileName] = useState("");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [progress, setProgress] = useState({ done: 0, total: 0, errors: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading) {
      if (!user) navigate({ to: "/login" });
      else if (profile && profile.role !== "admin") navigate({ to: "/" });
    }
  }, [user, profile, loading, navigate]);

  const processFile = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        toast.error("Selecione um arquivo .csv");
        return;
      }
      setFileName(file.name);
      setStage("parsing");

      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: false,
        complete: (result) => {
          try {
            const { products: parsed, skipped: skip } = parseMagentoRows(
              result.data,
              imageBase,
            );
            setProducts(parsed);
            setSkipped(skip);
            setStage("preview");
          } catch (err) {
            toast.error("Erro ao processar CSV");
            console.error(err);
            setStage("idle");
          }
        },
        error: (err) => {
          toast.error("Erro ao ler o CSV: " + err.message);
          setStage("idle");
        },
      });
    },
    [imageBase],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const reset = () => {
    setStage("idle");
    setProducts([]);
    setSkipped(0);
    setFileName("");
    setProgress({ done: 0, total: 0, errors: 0 });
  };

  const startImport = async () => {
    setStage("importing");
    const total = products.length;
    setProgress({ done: 0, total, errors: 0 });
    let errors = 0;

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await batchImportProducts({ data: batch as any });
      } catch {
        errors += batch.length;
      }
      setProgress({ done: Math.min(i + BATCH_SIZE, total), total, errors });
    }

    setStage("done");
    const imported = total - errors;
    if (errors === 0) {
      toast.success(`${imported.toLocaleString("pt-BR")} produtos importados!`);
    } else {
      toast.error(`${errors} lotes com erro — ${imported} importados.`);
    }
  };

  if (loading || !profile) return null;

  return (
    <AdminLayout title="Importar CSV do Magento">
      {/* Voltar */}
      <div className="mb-6">
        <Link
          to="/admin/produtos"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para produtos
        </Link>
      </div>

      {/* ── Idle ─────────────────────────────────────────────────────────── */}
      {stage === "idle" && (
        <div className="max-w-xl space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              URL base das imagens{" "}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <input
              type="text"
              value={imageBase}
              onChange={(e) => setImageBase(e.target.value)}
              placeholder="https://www.tendasex.com.br/pub/media/catalog/product"
              className="w-full rounded-md border border-border bg-secondary/20 px-3 py-2 text-sm placeholder:text-muted-foreground/40 focus:border-neon focus:outline-none"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Imagens do CSV têm caminhos relativos (ex: <code>/a/b/foto.jpg</code>).
              Preencha para montar a URL completa. Deixe vazio para importar só o caminho.
            </p>
          </div>

          <div
            onDragEnter={() => setIsDragging(true)}
            onDragLeave={() => setIsDragging(false)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-8 py-16 text-center transition-colors ${
              isDragging
                ? "border-neon bg-neon/5"
                : "border-border bg-secondary/10 hover:border-neon/50 hover:bg-secondary/20"
            }`}
          >
            <Upload
              className={`mb-4 h-10 w-10 ${isDragging ? "text-neon" : "text-muted-foreground"}`}
            />
            <p className="font-semibold">Arraste o CSV ou clique para selecionar</p>
            <p className="mt-1 text-sm text-muted-foreground">
              catalog_tendasex.csv — exportação Magento 1.x
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>
        </div>
      )}

      {/* ── Parsing ──────────────────────────────────────────────────────── */}
      {stage === "parsing" && (
        <div className="flex flex-col items-center justify-center py-28 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-neon" />
          <p className="font-semibold">Processando {fileName}…</p>
          <p className="text-sm text-muted-foreground">
            Agrupando produtos e mapeando campos
          </p>
        </div>
      )}

      {/* ── Preview ──────────────────────────────────────────────────────── */}
      {stage === "preview" && (
        <div className="max-w-3xl space-y-6">
          {/* Resumo numérico */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              icon={Package}
              label="Para importar"
              value={products.length.toLocaleString("pt-BR")}
              color="text-neon"
            />
            <StatCard
              icon={CheckCircle2}
              label="Ativos"
              value={products.filter((p) => p.active).length.toLocaleString("pt-BR")}
              color="text-green-400"
            />
            <StatCard
              icon={X}
              label="Ignorados"
              value={skipped.toLocaleString("pt-BR")}
              color="text-muted-foreground"
            />
          </div>

          {/* Prévia dos primeiros produtos */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="border-b border-border bg-secondary/30 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Prévia — primeiros {Math.min(5, products.length)} de{" "}
              {products.length.toLocaleString("pt-BR")} produtos
            </div>
            <div className="divide-y divide-border">
              {products.slice(0, 5).map((p, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  {p.images[0] ? (
                    <img
                      src={p.images[0]}
                      alt=""
                      className="h-10 w-10 flex-none rounded object-cover bg-secondary"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="h-10 w-10 flex-none rounded bg-secondary" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-sm">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground font-mono">
                      {p.slug}
                      {p.category && (
                        <span className="ml-2 text-muted-foreground/60">· {p.category}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex-none text-right">
                    <p className="text-sm font-bold text-neon">
                      R$ {p.price.toFixed(2).replace(".", ",")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.stock} un · {p.active ? "Ativo" : "Inativo"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Aviso upsert */}
          <div className="flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
            <p>
              Produtos com slug já existente serão <strong>atualizados</strong>.
              Novos slugs serão inseridos como novos produtos.
            </p>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-3">
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium hover:border-foreground transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Trocar arquivo
            </button>
            <button
              onClick={startImport}
              disabled={products.length === 0}
              className="rounded-md bg-neon px-6 py-2.5 text-sm font-bold text-primary-foreground glow transition-transform hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Importar {products.length.toLocaleString("pt-BR")} produtos
            </button>
          </div>
        </div>
      )}

      {/* ── Importando ───────────────────────────────────────────────────── */}
      {stage === "importing" && (
        <div className="max-w-lg space-y-6">
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-neon" />
                Importando produtos…
              </span>
              <span className="font-mono text-muted-foreground">
                {progress.done.toLocaleString("pt-BR")} /{" "}
                {progress.total.toLocaleString("pt-BR")}
              </span>
            </div>

            <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-neon transition-all duration-300"
                style={{
                  width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%`,
                }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {progress.total > 0
                  ? `${Math.round((progress.done / progress.total) * 100)}%`
                  : "0%"}
              </span>
              {progress.errors > 0 && (
                <span className="text-destructive">
                  {progress.errors} com erro
                </span>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Não feche esta página durante a importação
            </p>
          </div>
        </div>
      )}

      {/* ── Concluído ────────────────────────────────────────────────────── */}
      {stage === "done" && (
        <div className="max-w-lg space-y-6">
          <div className="rounded-lg border border-neon/30 bg-neon/5 p-8 text-center space-y-3">
            <CheckCircle2 className="mx-auto h-12 w-12 text-neon" />
            <h2 className="font-display text-xl font-bold">Importação concluída!</h2>
            <p className="text-muted-foreground">
              <span className="text-foreground font-semibold">
                {(progress.done - progress.errors).toLocaleString("pt-BR")}
              </span>{" "}
              produtos importados com sucesso
              {progress.errors > 0 && (
                <>
                  {" · "}
                  <span className="text-destructive font-semibold">
                    {progress.errors} com erro
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="flex justify-center gap-3">
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium hover:border-foreground transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Nova importação
            </button>
            <Link
              to="/admin/produtos"
              className="rounded-md bg-neon px-6 py-2.5 text-sm font-bold text-primary-foreground glow transition-transform hover:scale-[1.01]"
            >
              Ver produtos
            </Link>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className={`mt-2 font-display text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

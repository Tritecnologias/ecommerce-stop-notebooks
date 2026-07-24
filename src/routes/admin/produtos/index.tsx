import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Package,
  AlertTriangle, CheckCircle2, Star, Heart, FileUp, Search,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  getAdminProductsPaged, getAdminProductStats,
  deleteProduct, updateProduct, adjustStock,
} from "@/fns/products";
import { getTopWishlisted } from "@/fns/wishlist";
import { StockMovements } from "./-stock-movements";
import { formatBRL } from "@/lib/cart";
import { AdminLayout } from "@/routes/admin/index";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/produtos/")({
  head: () => ({ meta: [{ title: "Produtos — Admin Secret Desire" }] }),
  component: AdminProducts,
});

// ─── Nível de estoque ───────────────────────────────────────────────────────
function stockLevel(stock: number): "critical" | "low" | "ok" {
  if (stock < 5) return "critical";
  if (stock < 10) return "low";
  return "ok";
}

const stockBadge = {
  critical: "bg-destructive/15 text-destructive border border-destructive/40",
  low: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/40",
  ok: "bg-green-500/10 text-green-400 border border-green-500/30",
};

const stockIcon = {
  critical: <AlertTriangle className="h-3 w-3" />,
  low: <AlertTriangle className="h-3 w-3" />,
  ok: <CheckCircle2 className="h-3 w-3" />,
};

// ─── Célula de estoque editável inline ──────────────────────────────────────
function StockCell({ product }: { product: { id: string; name: string; stock: number } }) {
  const { user, profile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [localStock, setLocalStock] = useState(product.stock);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  useEffect(() => {
    if (!editing) setLocalStock(product.stock);
  }, [product.stock, editing]);

  const level = stockLevel(localStock);
  const adminName = profile?.name ?? user?.email ?? undefined;

  const saveMut = useMutation({
    mutationFn: (stock: number) => adjustStock({
      data: { id: product.id, stock, adminId: user?.id, adminName },
    }),
    onSuccess: (_result, stock) => {
      setLocalStock(stock);
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-product-stats"] });
      toast.success(`Estoque: ${stock} un.`);
    },
    onError: (err) => {
      setLocalStock(product.stock);
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar estoque");
    },
  });

  const startEdit = () => {
    setInputValue(String(localStock));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const cancelEdit = () => setEditing(false);

  const saveEdit = () => {
    const n = parseInt(inputValue, 10);
    setEditing(false);
    if (isNaN(n) || n < 0) { toast.error("Valor inválido"); return; }
    if (n === localStock) return;
    setLocalStock(n);
    saveMut.mutate(n);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); saveEdit(); }
    if (e.key === "Escape") cancelEdit();
  };

  const adjust = (delta: number) => {
    if (saveMut.isPending) return;
    const n = Math.max(0, localStock + delta);
    if (n === localStock) return;
    setLocalStock(n);
    saveMut.mutate(n);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="number"
          min="0"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKey}
          onBlur={saveEdit}
          className="w-20 rounded border border-neon bg-background px-2 py-1 text-sm font-mono focus:outline-none"
        />
        <span className="text-xs text-muted-foreground">un</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={startEdit}
        disabled={saveMut.isPending}
        title="Clique para editar estoque"
        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold transition hover:opacity-80 cursor-pointer ${stockBadge[level]}`}
      >
        {stockIcon[level]}
        {saveMut.isPending ? "…" : `${localStock} un`}
      </button>
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => adjust(-1)}
          disabled={saveMut.isPending || localStock === 0}
          title="–1"
          className="flex h-6 w-6 items-center justify-center rounded border border-border text-xs text-muted-foreground hover:border-destructive hover:text-destructive disabled:opacity-30 transition"
        >
          −
        </button>
        <button
          onClick={() => adjust(+1)}
          disabled={saveMut.isPending}
          title="+1"
          className="flex h-6 w-6 items-center justify-center rounded border border-border text-xs text-muted-foreground hover:border-neon hover:text-neon disabled:opacity-30 transition"
        >
          +
        </button>
        <button
          onClick={() => adjust(+10)}
          disabled={saveMut.isPending}
          title="+10"
          className="flex h-6 items-center justify-center rounded border border-border px-1.5 text-xs text-muted-foreground hover:border-neon hover:text-neon disabled:opacity-30 transition"
        >
          +10
        </button>
      </div>
    </div>
  );
}

// ─── Tag destaque inline ─────────────────────────────────────────────────────
const TAG_OPTIONS = ["Mais Vendido", "Lançamento", "Frete Grátis"] as const;
type Tag = (typeof TAG_OPTIONS)[number] | null;

const tagStyle: Record<string, string> = {
  "Mais Vendido": "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  "Lançamento": "bg-blue-500/10 text-blue-400 border-blue-500/30",
  "Frete Grátis": "bg-green-500/10 text-green-400 border-green-500/30",
};

function TagCell({ product }: { product: { id: string; tag?: string | null } }) {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: (tag: Tag) => updateProduct({ data: { id: product.id, data: { tag } } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-products"] }),
    onError: () => toast.error("Erro ao atualizar destaque"),
  });

  return (
    <select
      value={product.tag ?? ""}
      disabled={mut.isPending}
      onChange={(e) => mut.mutate((e.target.value || null) as Tag)}
      className={`rounded-md border px-2 py-1 text-xs font-semibold bg-transparent cursor-pointer disabled:opacity-50 transition ${
        product.tag ? tagStyle[product.tag] ?? "border-border" : "border-border text-muted-foreground"
      }`}
    >
      <option value="">— Nenhuma</option>
      {TAG_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
    </select>
  );
}

// ─── Resumo de estoque ───────────────────────────────────────────────────────
function StockSummary({ stats }: {
  stats?: { total: number; totalUnits: number; critical: number; low: number; ok: number };
}) {
  if (!stats) return null;
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <SummaryCard icon={Package} label="Total em estoque" value={`${stats.totalUnits} un`} color="text-foreground" />
      <SummaryCard icon={CheckCircle2} label="Estoque ok" value={String(stats.ok)} color="text-green-400" />
      <SummaryCard icon={AlertTriangle} label="Estoque baixo" value={String(stats.low)} color="text-yellow-400" />
      <SummaryCard icon={AlertTriangle} label="Crítico / Zerado" value={String(stats.critical)} color="text-destructive" />
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }: { icon: typeof Package; label: string; value: string; color: string }) {
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

// ─── Mais desejados (Wishlist demand) ────────────────────────────────────────
function WishlistDemand() {
  const [expanded, setExpanded] = useState(false);
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-top-wishlisted"],
    queryFn: () => getTopWishlisted(),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="mb-6 rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-sm font-semibold hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
          <span>Mais desejados</span>
          {!isLoading && items.length > 0 && (
            <span className="ml-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-bold text-rose-400">
              {items.length}
            </span>
          )}
        </div>
        <span className="text-muted-foreground text-xs">{expanded ? "▲ recolher" : "▼ expandir"}</span>
      </button>

      {expanded && (
        <div className="border-t border-border px-5 py-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-2">Carregando…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Nenhum produto favoritado ainda.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {items.map((item, i) => (
                <div
                  key={item.product_id}
                  className="flex items-center gap-3 rounded-md border border-border bg-secondary/20 p-2.5"
                >
                  <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-bold ${
                    i === 0 ? "bg-yellow-500/20 text-yellow-400" :
                    i === 1 ? "bg-zinc-400/20 text-zinc-400" :
                    i === 2 ? "bg-orange-700/20 text-orange-600" :
                    "bg-secondary text-muted-foreground"
                  }`}>
                    {i + 1}
                  </span>
                  {item.product_image ? (
                    <img src={item.product_image} alt="" className="h-9 w-9 flex-none rounded-md object-cover" />
                  ) : (
                    <div className="h-9 w-9 flex-none rounded-md bg-secondary" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold leading-tight">{item.product_name}</p>
                    <div className="mt-0.5 flex items-center gap-1">
                      <Heart className="h-3 w-3 fill-rose-500 text-rose-500" />
                      <span className="text-xs font-bold text-rose-400">{item.wish_count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Paginação ────────────────────────────────────────────────────────────────
function Pagination({
  page, totalPages, total, pageSize, onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">
        Mostrando <span className="font-semibold text-foreground">{from}–{to}</span> de{" "}
        <span className="font-semibold text-foreground">{total.toLocaleString("pt-BR")}</span> produtos
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:border-neon hover:text-neon disabled:opacity-30 transition"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {/* Janela de páginas */}
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let p: number;
          if (totalPages <= 5) {
            p = i + 1;
          } else if (page <= 3) {
            p = i + 1;
          } else if (page >= totalPages - 2) {
            p = totalPages - 4 + i;
          } else {
            p = page - 2 + i;
          }
          return (
            <button
              key={p}
              onClick={() => onPage(p)}
              className={`flex h-8 w-8 items-center justify-center rounded-md border text-xs font-semibold transition ${
                p === page
                  ? "border-neon bg-neon/10 text-neon"
                  : "border-border text-muted-foreground hover:border-neon hover:text-neon"
              }`}
            >
              {p}
            </button>
          );
        })}
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:border-neon hover:text-neon disabled:opacity-30 transition"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────
const PAGE_SIZE = 50;

function AdminProducts() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [tagFilter, setTagFilter] = useState<string>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!loading) {
      if (!user) navigate({ to: "/login" });
      else if (profile && profile.role !== "admin") navigate({ to: "/" });
    }
  }, [user, profile, loading, navigate]);

  // Debounce da busca
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Volta para página 1 ao mudar filtro
  useEffect(() => { setPage(1); }, [tagFilter]);

  const enabled = !!user && profile?.role === "admin";

  const { data: stats } = useQuery({
    queryKey: ["admin-product-stats"],
    queryFn: () => getAdminProductStats(),
    enabled,
    staleTime: 60_000,
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-products", page, PAGE_SIZE, search, tagFilter],
    queryFn: () => getAdminProductsPaged({
      data: {
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        tag: tagFilter === "all" ? undefined : tagFilter,
      },
    }),
    enabled,
    placeholderData: (prev) => prev,
  });

  const products = data?.products ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteProduct({ data: id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-product-stats"] });
      toast.success("Produto excluído");
    },
    onError: () => toast.error("Erro ao excluir produto"),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      updateProduct({ data: { id, data: { active } } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-products"] }),
  });

  if (loading || !profile) return null;

  return (
    <AdminLayout title="Produtos">
      <StockSummary stats={stats} />

      <WishlistDemand />

      <div className="mb-6">
        <StockMovements />
      </div>

      {/* Filtros + busca */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Star className="h-4 w-4 text-muted-foreground flex-none" />
        {[
          { value: "all", label: "Todos" },
          { value: "none", label: "Sem destaque" },
          ...TAG_OPTIONS.map((t) => ({ value: t, label: t })),
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => setTagFilter(opt.value)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              tagFilter === opt.value
                ? "border-neon bg-neon/10 text-neon"
                : "border-border text-muted-foreground hover:border-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}

        {/* Busca */}
        <div className="relative ml-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nome, slug ou categoria…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-8 w-64 rounded-md border border-border bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:border-neon focus:outline-none"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/admin/produtos/importar"
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium hover:border-neon hover:text-neon transition-colors"
          >
            <FileUp className="h-4 w-4" /> Importar CSV
          </Link>
          <Link
            to="/admin/produtos/novo"
            className="inline-flex items-center gap-2 rounded-md bg-neon px-4 py-2.5 text-sm font-bold text-primary-foreground glow transition-transform hover:scale-[1.01]"
          >
            <Plus className="h-4 w-4" /> Novo produto
          </Link>
        </div>
      </div>

      <div className={`rounded-lg border border-border bg-card overflow-hidden transition-opacity ${isFetching ? "opacity-70" : ""}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Preço</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Destaque</th>
                <th className="px-4 py-3">
                  Estoque
                  <span className="ml-1 text-[10px] normal-case tracking-normal text-muted-foreground/60">
                    (clique para editar)
                  </span>
                </th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhum produto encontrado.</td></tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {product.images[0] && (
                          <img src={product.images[0]} alt="" className="h-10 w-10 rounded-md object-cover flex-none" />
                        )}
                        <div>
                          <p className="font-semibold leading-tight">{product.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{product.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-neon">{formatBRL(product.price)}</p>
                      {product.old_price && (
                        <p className="text-xs text-muted-foreground line-through">{formatBRL(product.old_price)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{product.category ?? "—"}</td>
                    <td className="px-4 py-3">
                      <TagCell product={{ id: product.id, tag: product.tag }} />
                    </td>
                    <td className="px-4 py-3">
                      <StockCell product={{ id: product.id, name: product.name, stock: product.stock }} />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleMut.mutate({ id: product.id, active: !product.active })}
                        className="flex items-center gap-1.5 text-xs"
                      >
                        {product.active
                          ? <ToggleRight className="h-5 w-5 text-neon" />
                          : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                        <span className={product.active ? "text-neon" : "text-muted-foreground"}>
                          {product.active ? "Ativo" : "Inativo"}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          to="/admin/produtos/$id"
                          params={{ id: product.id }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:border-neon hover:text-neon transition-colors"
                          title="Editar produto completo"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          onClick={() => {
                            if (confirm(`Excluir "${product.name}"?`)) deleteMut.mutate(product.id);
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:border-destructive hover:text-destructive transition-colors"
                          title="Excluir produto"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {total > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={PAGE_SIZE}
          onPage={setPage}
        />
      )}

      {/* Legenda */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-green-500/30 border border-green-500/40" /> ≥ 10 un — Ok
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-yellow-500/30 border border-yellow-500/40" /> 5–9 un — Estoque baixo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-destructive/30 border border-destructive/40" /> &lt; 5 un — Crítico
        </span>
      </div>
    </AdminLayout>
  );
}

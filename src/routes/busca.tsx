import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Search, Package, X, SlidersHorizontal, ArrowUpDown } from "lucide-react";
import { searchProducts } from "@/fns/products";
import { dbProductToProduct } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";

// ─── Validação de search params ───────────────────────────────────────────────

function validateSearch(search: Record<string, unknown>) {
  return {
    q: String(search.q ?? ""),
    categoria: String(search.categoria ?? ""),
    tag: String(search.tag ?? ""),
    ordenar: String(search.ordenar ?? "relevancia"),
    minPreco: search.minPreco != null ? Number(search.minPreco) : undefined,
    maxPreco: search.maxPreco != null ? Number(search.maxPreco) : undefined,
  };
}

export const Route = createFileRoute("/busca")({
  validateSearch,
  head: ({ match }) => {
    const q = (match as { search?: { q?: string } }).search?.q ?? "";
    return {
      meta: [
        { title: q ? `Busca: "${q}" — Secret Desire` : "Busca — Secret Desire" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: BuscaPage,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase().trim());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-neon/30 text-neon rounded px-0.5">
        {text.slice(idx, idx + query.trim().length)}
      </mark>
      {text.slice(idx + query.trim().length)}
    </>
  );
}

const SORT_LABELS: Record<string, string> = {
  relevancia: "Relevância",
  preco_asc: "Menor preço",
  preco_desc: "Maior preço",
  nome_asc: "A → Z",
  nome_desc: "Z → A",
  avaliacao: "Melhor avaliação",
};

const TAG_OPTIONS = ["Mais Vendido", "Lançamento", "Frete Grátis"];

// ─── Componente ───────────────────────────────────────────────────────────────

function BuscaPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/busca" });
  const inputRef = useRef<HTMLInputElement>(null);

  const [inputValue, setInputValue] = useState(search.q);
  const [showFilters, setShowFilters] = useState(false);

  // Sincroniza input se a URL mudar externamente
  useEffect(() => {
    setInputValue(search.q);
  }, [search.q]);

  // Focus automático ao entrar na página
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ── Busca server-side ─────────────────────────────────────────────────────
  const { data: dbProducts, isLoading, isFetching } = useQuery({
    queryKey: ["search", search.q],
    queryFn: () => searchProducts({ data: search.q }),
    enabled: search.q.trim().length >= 2,
    staleTime: 30_000,
  });

  // ── Mapeamento + filtros client-side (categoria, tag, preço) ──────────────
  let products = (dbProducts ?? []).map(dbProductToProduct);

  if (search.categoria) {
    products = products.filter((p) => p.category === search.categoria);
  }
  if (search.tag) {
    products = products.filter((p) => p.tag === search.tag);
  }
  if (search.minPreco != null) {
    products = products.filter((p) => p.price >= search.minPreco!);
  }
  if (search.maxPreco != null) {
    products = products.filter((p) => p.price <= search.maxPreco!);
  }

  // Ordenação
  switch (search.ordenar) {
    case "preco_asc":
      products = [...products].sort((a, b) => a.price - b.price);
      break;
    case "preco_desc":
      products = [...products].sort((a, b) => b.price - a.price);
      break;
    case "nome_asc":
      products = [...products].sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "nome_desc":
      products = [...products].sort((a, b) => b.name.localeCompare(a.name));
      break;
    case "avaliacao":
      products = [...products].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      break;
  }

  // Categorias disponíveis nos resultados
  const categories = [...new Set(
    (dbProducts ?? []).map(dbProductToProduct).map((p) => p.category).filter(Boolean) as string[]
  )];

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (inputValue.trim().length < 2) return;
    navigate({ search: (prev) => ({ ...prev, q: inputValue.trim(), categoria: "", tag: "" }) });
  }

  function setParam<K extends keyof ReturnType<typeof validateSearch>>(
    key: K,
    value: ReturnType<typeof validateSearch>[K],
  ) {
    navigate({ search: (prev) => ({ ...prev, [key]: value }) });
  }

  function clearFilters() {
    navigate({ search: (prev) => ({ ...prev, categoria: "", tag: "", minPreco: undefined, maxPreco: undefined }) });
  }

  const hasActiveFilters = !!(search.categoria || search.tag || search.minPreco != null || search.maxPreco != null);
  const isSearching = search.q.trim().length >= 2;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">

      {/* ── Barra de busca ──────────────────────────────────────────────── */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm focus-within:border-neon transition-colors">
          <Search className="h-5 w-5 flex-none text-neon" />
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Buscar produto, categoria, marca…"
            className="flex-1 bg-transparent text-base placeholder:text-muted-foreground focus:outline-none"
          />
          {inputValue && (
            <button
              type="button"
              onClick={() => { setInputValue(""); navigate({ search: (prev) => ({ ...prev, q: "" }) }); }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            type="submit"
            className="rounded-md bg-neon px-4 py-1.5 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.02] glow"
          >
            Buscar
          </button>
        </div>
      </form>

      {/* ── Resultados + filtros ─────────────────────────────────────────── */}
      {!isSearching ? (
        <div className="py-16 text-center">
          <Search className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
          <p className="text-muted-foreground">Digite pelo menos 2 caracteres para buscar produtos</p>
        </div>
      ) : (
        <div className="flex gap-6 items-start">

          {/* ── Sidebar de filtros ─────────────────────────────────────── */}
          <aside className="hidden lg:block w-56 flex-none space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-neon" /> Filtros
              </h2>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="text-xs text-neon hover:underline">
                  Limpar
                </button>
              )}
            </div>

            {/* Categoria */}
            {categories.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categoria</p>
                <div className="space-y-1">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setParam("categoria", search.categoria === cat ? "" : cat)}
                      className={`w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                        search.categoria === cat
                          ? "bg-neon/10 text-neon"
                          : "text-muted-foreground hover:bg-secondary/60"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tag */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Destaque</p>
              <div className="space-y-1">
                {TAG_OPTIONS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setParam("tag", search.tag === t ? "" : t)}
                    className={`w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                      search.tag === t
                        ? "bg-neon/10 text-neon"
                        : "text-muted-foreground hover:bg-secondary/60"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* ── Conteúdo principal ─────────────────────────────────────── */}
          <div className="flex-1 min-w-0">

            {/* Header resultados */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                {isLoading || isFetching ? (
                  <p className="text-sm text-muted-foreground animate-pulse">Buscando…</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {products.length === 0 ? "Nenhum resultado" : (
                      <>
                        <span className="font-semibold text-foreground">{products.length}</span>{" "}
                        {products.length === 1 ? "produto" : "produtos"} para{" "}
                        <span className="font-semibold text-neon">"{search.q}"</span>
                      </>
                    )}
                  </p>
                )}
                {hasActiveFilters && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {search.categoria && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-neon/10 px-2.5 py-0.5 text-xs text-neon">
                        {search.categoria}
                        <button onClick={() => setParam("categoria", "")}><X className="h-3 w-3" /></button>
                      </span>
                    )}
                    {search.tag && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-neon/10 px-2.5 py-0.5 text-xs text-neon">
                        {search.tag}
                        <button onClick={() => setParam("tag", "")}><X className="h-3 w-3" /></button>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Ordenação + filtros mobile */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="lg:hidden flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:border-neon"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" /> Filtros
                  {hasActiveFilters && <span className="ml-1 rounded-full bg-neon w-1.5 h-1.5" />}
                </button>
                <div className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5">
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  <select
                    value={search.ordenar}
                    onChange={(e) => setParam("ordenar", e.target.value)}
                    className="bg-transparent text-xs focus:outline-none"
                  >
                    {Object.entries(SORT_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Filtros mobile expandíveis */}
            {showFilters && (
              <div className="mb-5 lg:hidden rounded-lg border border-border bg-card p-4 space-y-4">
                {categories.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categoria</p>
                    <div className="flex flex-wrap gap-2">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setParam("categoria", search.categoria === cat ? "" : cat)}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                            search.categoria === cat ? "border-neon bg-neon/10 text-neon" : "border-border text-muted-foreground"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Destaque</p>
                  <div className="flex flex-wrap gap-2">
                    {TAG_OPTIONS.map((t) => (
                      <button
                        key={t}
                        onClick={() => setParam("tag", search.tag === t ? "" : t)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          search.tag === t ? "border-neon bg-neon/10 text-neon" : "border-border text-muted-foreground"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  {hasActiveFilters && (
                    <button onClick={clearFilters} className="text-xs text-neon hover:underline">Limpar filtros</button>
                  )}
                  <button onClick={() => setShowFilters(false)} className="text-xs text-muted-foreground hover:text-foreground ml-auto">
                    Fechar
                  </button>
                </div>
              </div>
            )}

            {/* Grid de produtos */}
            {isLoading ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="rounded-xl border border-border bg-card animate-pulse">
                    <div className="aspect-square bg-secondary/40 rounded-t-xl" />
                    <div className="p-4 space-y-2">
                      <div className="h-4 w-3/4 bg-secondary/60 rounded" />
                      <div className="h-3 w-1/2 bg-secondary/40 rounded" />
                      <div className="h-5 w-1/3 bg-secondary/60 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="py-16 text-center">
                <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
                <p className="font-semibold">Nenhum produto encontrado</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tente buscar com outras palavras{hasActiveFilters ? " ou remova os filtros" : ""}.
                </p>
                {hasActiveFilters && (
                  <button onClick={clearFilters} className="mt-4 text-sm text-neon hover:underline">
                    Remover filtros
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

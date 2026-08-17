import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, Fragment } from "react";
import { ArrowRight, Sparkles, Truck, Shield, Star, Gift, Zap, Heart, Lock, Package, Award, Clock, X, SlidersHorizontal, ArrowUpDown, ChevronDown } from "lucide-react";
import { PRODUCTS, dbProductToProduct } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import { useCart } from "@/lib/cart";
import { getProducts, getProductsPaginated } from "@/fns/products";
import { getActiveBanners } from "@/fns/banners";
import { getHomeContent, DEFAULT_HOME, type TrustBadgeIcon } from "@/fns/home";
import heroImg from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  component: Index,
});

// ─── Ícone dinâmico para trust badges ────────────────────────────────────────
const TRUST_ICONS: Record<TrustBadgeIcon, typeof Truck> = {
  truck: Truck, shield: Shield, star: Star, gift: Gift,
  zap: Zap, heart: Heart, lock: Lock, package: Package,
  award: Award, clock: Clock,
};

function TrustIcon({ id, className }: { id: TrustBadgeIcon; className?: string }) {
  const Icon = TRUST_ICONS[id] ?? Shield;
  return <Icon className={className} />;
}

// ─── Renderiza o headingPost com quebras de linha ─────────────────────────────
function HeadingPost({ text }: { text: string }) {
  const parts = text.split("\\n");
  return (
    <>
      {parts.map((part, i) =>
        i === 0 ? (
          <Fragment key={i}>{part}</Fragment>
        ) : (
          <Fragment key={i}>
            <br />
            {part}
          </Fragment>
        ),
      )}
    </>
  );
}

// ─── Tipos de filtro ──────────────────────────────────────────────────────────
type SortOption = "destaque" | "preco_asc" | "preco_desc" | "avaliacao" | "novidades";
const SORT_LABELS: Record<SortOption, string> = {
  destaque: "Destaque",
  preco_asc: "Menor preço",
  preco_desc: "Maior preço",
  avaliacao: "Melhor avaliação",
  novidades: "Novidades",
};
const TAG_OPTIONS = ["Mais Vendido", "Lançamento", "Frete Grátis"] as const;
const FOR_WHOM_OPTIONS = [
  { value: "ela", label: "Para Ela" },
  { value: "ele", label: "Para Ele" },
  { value: "casal", label: "Para Casais" },
  { value: "todos", label: "Unissex" },
] as const;
const EXPERIENCE_OPTIONS = [
  { value: "iniciante", label: "Iniciante" },
  { value: "intermediario", label: "Intermediário" },
  { value: "avancado", label: "Avançado" },
] as const;

// ─── Componente principal ─────────────────────────────────────────────────────
function Index() {
  const { setProductsCache } = useCart();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Filtros avançados
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedForWhom, setSelectedForWhom] = useState<string | null>(null);
  const [selectedExperience, setSelectedExperience] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("destaque");
  const [minPreco, setMinPreco] = useState("");
  const [maxPreco, setMaxPreco] = useState("");
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 24;

  const { data: paginatedData, isLoading: loadingProducts } = useQuery({
    queryKey: ["products-paginated", page, selectedCategory, selectedTag, selectedForWhom, selectedExperience, sortBy],
    queryFn: () => getProductsPaginated({
      data: {
        page,
        limit: PAGE_SIZE,
        category: selectedCategory || undefined,
        tag: selectedTag || undefined,
        forWhom: selectedForWhom || undefined,
        experienceLevel: selectedExperience || undefined,
        sort: sortBy,
      },
    }),
    staleTime: 2 * 60 * 1000,
  });

  const { data: dbProducts } = useQuery({
    queryKey: ["products-featured"],
    queryFn: () => getProducts(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: banners } = useQuery({
    queryKey: ["active-banners"],
    queryFn: () => getActiveBanners(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: homeData } = useQuery({
    queryKey: ["home-content"],
    queryFn: () => getHomeContent(),
    staleTime: 5 * 60 * 1000,
  });

  // Usa conteúdo do DB ou os defaults enquanto carrega
  const c = homeData ?? DEFAULT_HOME;

  const products = dbProducts ? dbProducts.map(dbProductToProduct) : PRODUCTS;

  useEffect(() => {
    if (products.length > 0) setProductsCache(products);
  }, [products]);

  const bestsellers = products.filter((p) => p.tag === "Mais Vendido").slice(0, 6);
  const novidades = products.filter((p) => p.tag === "Lançamento").slice(0, 6);

  const visibleCategories = c.categories.filter((cat) => cat.visible);

  // Produtos da coleção vêm paginados do servidor
  const collectionProducts = paginatedData
    ? paginatedData.products.map(dbProductToProduct)
    : products;
  const totalProducts = paginatedData?.total ?? collectionProducts.length;
  const totalPages = paginatedData?.totalPages ?? 1;

  // Filtros de preço e estoque aplicados client-side (sobre a página atual)
  let filteredProducts = collectionProducts;
  const minP = minPreco !== "" ? parseFloat(minPreco) : null;
  const maxP = maxPreco !== "" ? parseFloat(maxPreco) : null;
  if (minP !== null && !isNaN(minP)) {
    filteredProducts = filteredProducts.filter((p) => p.price >= minP);
  }
  if (maxP !== null && !isNaN(maxP)) {
    filteredProducts = filteredProducts.filter((p) => p.price <= maxP);
  }
  if (onlyInStock) {
    filteredProducts = filteredProducts.filter((p) => (p.stock ?? 0) > 0);
  }

  const activeFilterCount =
    (selectedTag ? 1 : 0) +
    (selectedForWhom ? 1 : 0) +
    (selectedExperience ? 1 : 0) +
    (onlyInStock ? 1 : 0) +
    (minPreco !== "" ? 1 : 0) +
    (maxPreco !== "" ? 1 : 0);

  function clearAllFilters() {
    setSelectedCategory(null);
    setSelectedTag(null);
    setSelectedForWhom(null);
    setSelectedExperience(null);
    setSortBy("destaque");
    setMinPreco("");
    setMaxPreco("");
    setOnlyInStock(false);
    setPage(1);
  }

  const heroImage = c.hero.imageUrl || heroImg;

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [selectedCategory, selectedTag, selectedForWhom, selectedExperience, sortBy]);

  return (
    <>
      {/* ── BARRA PROMOCIONAL ─────────────────────────────────────────── */}
      {c.promoBar.visible && (
        <div
          className="relative flex items-center justify-center gap-3 px-4 py-2.5 text-center text-sm font-medium"
          style={{ background: c.promoBar.bgColor, color: c.promoBar.textColor }}
        >
          <span>{c.promoBar.text}</span>
          {c.promoBar.btnText && c.promoBar.btnUrl && (
            <a
              href={c.promoBar.btnUrl}
              className="flex-none rounded border border-current/30 px-3 py-0.5 text-xs font-bold hover:bg-white/10 transition-colors"
            >
              {c.promoBar.btnText}
            </a>
          )}
        </div>
      )}

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero opacity-70" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 md:grid-cols-2 md:items-center md:gap-8 md:px-6 md:py-24">
          <div className="animate-fade-in">
            {c.hero.badge && (
              <span className="inline-flex items-center gap-2 rounded-full border border-neon/40 bg-neon/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-neon">
                <Sparkles className="h-3.5 w-3.5" /> {c.hero.badge}
              </span>
            )}
            <h1 className="mt-5 font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
              {c.hero.headingPre}{c.hero.headingPre ? " " : ""}
              <span className="neon-text">{c.hero.headingHighlight}</span>
              <HeadingPost text={c.hero.headingPost} />
            </h1>
            <p className="mt-5 max-w-md text-base text-muted-foreground md:text-lg">
              {c.hero.description}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {c.hero.primaryBtnText && (
                <a
                  href={c.hero.primaryBtnUrl}
                  className="group inline-flex items-center gap-2 rounded-md bg-neon px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-transform hover:scale-[1.02] glow"
                >
                  {c.hero.primaryBtnText}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </a>
              )}
              {c.hero.secondaryBtnText && (
                <a
                  href={c.hero.secondaryBtnUrl}
                  className="rounded-md border border-border px-6 py-3 text-sm font-semibold hover:border-neon hover:text-neon transition-colors"
                >
                  {c.hero.secondaryBtnText}
                </a>
              )}
            </div>

            {c.trustBadges.length > 0 && (
              <div className="mt-10 flex flex-wrap gap-6 text-xs text-muted-foreground">
                {c.trustBadges.map((badge, i) => (
                  <span key={i} className="inline-flex items-center gap-2">
                    <TrustIcon id={badge.icon} className="h-4 w-4 text-neon" />
                    {badge.text}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="relative animate-fade-in">
            <div className="absolute -inset-8 rounded-full bg-neon/20 blur-3xl" />
            <img
              src={heroImage}
              alt={c.hero.imageAlt}
              width={1600}
              height={1000}
              className="relative w-full rounded-xl border border-border object-cover"
            />
          </div>
        </div>
      </section>

      {/* ── BANNERS ───────────────────────────────────────────────────── */}
      {banners && banners.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-8 md:px-6 space-y-3">
          {banners.map((banner) => {
            const inner = (
              <div
                className="flex items-center gap-4 rounded-xl px-6 py-5 text-white shadow-md"
                style={{ background: `linear-gradient(135deg, ${banner.bg_from}, ${banner.bg_to})` }}
              >
                <div className="flex-1 min-w-0">
                  {banner.badge && (
                    <span className="mb-1.5 inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                      {banner.badge}
                    </span>
                  )}
                  <p className="font-display font-bold text-lg leading-tight">{banner.title}</p>
                  {banner.subtitle && <p className="mt-0.5 text-sm text-white/75">{banner.subtitle}</p>}
                </div>
                {banner.button_label && (
                  <span className="flex-none rounded-md bg-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/30 transition-colors">
                    {banner.button_label}
                  </span>
                )}
              </div>
            );
            return banner.button_url ? (
              <a key={banner.id} href={banner.button_url} className="block">
                {inner}
              </a>
            ) : (
              <div key={banner.id}>{inner}</div>
            );
          })}
        </section>
      )}

      {/* ── CATEGORIAS ────────────────────────────────────────────────── */}
      {visibleCategories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-10 md:px-6">
          <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`flex-none flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap ${
                selectedCategory === null
                  ? "border-neon bg-neon/10 text-neon"
                  : "border-border text-muted-foreground hover:border-foreground"
              }`}
            >
              Todos
            </button>
            {visibleCategories.map((cat) => (
              <button
                key={cat.name}
                onClick={() =>
                  setSelectedCategory(
                    selectedCategory === cat.filterCategory ? null : cat.filterCategory,
                  )
                }
                className={`flex-none flex items-center gap-2.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap ${
                  selectedCategory === cat.filterCategory
                    ? "border-neon bg-neon/10 text-neon"
                    : "border-border text-muted-foreground hover:border-foreground"
                }`}
              >
                {cat.imageUrl && (
                  <img
                    src={cat.imageUrl}
                    alt={cat.name}
                    className="h-5 w-5 rounded-full object-cover"
                  />
                )}
                {cat.name}
              </button>
            ))}
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="flex-none flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground ml-1"
              >
                <X className="h-3.5 w-3.5" /> Limpar filtro
              </button>
            )}
          </div>
        </section>
      )}

      {/* ── BARRA DE ORDENAÇÃO + FILTROS ─────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pt-4 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Contador de resultados */}
          <p className="text-sm text-muted-foreground">
            {totalProducts}{" "}
            {totalProducts === 1 ? "produto" : "produtos"}
            {(selectedCategory || activeFilterCount > 0) && (
              <button
                onClick={clearAllFilters}
                className="ml-2 inline-flex items-center gap-1 rounded-full bg-neon/10 px-2 py-0.5 text-xs text-neon hover:bg-neon/20 transition-colors"
              >
                <X className="h-3 w-3" /> Limpar filtros
              </button>
            )}
          </p>

          {/* Ações */}
          <div className="flex items-center gap-2">
            {/* Botão filtros avançados */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                showFilters || activeFilterCount > 0
                  ? "border-neon bg-neon/5 text-neon"
                  : "border-border text-muted-foreground hover:border-foreground"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtros
              {activeFilterCount > 0 && (
                <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-neon text-[10px] font-bold text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown className={`h-3 w-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
            </button>

            {/* Ordenação */}
            <div className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5">
              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-transparent text-xs focus:outline-none"
              >
                {Object.entries(SORT_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Painel de filtros expandível */}
        {showFilters && (
          <div className="mt-3 rounded-lg border border-border bg-card/60 p-4 space-y-4 animate-in slide-in-from-top-2 duration-150">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

              {/* Tag */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Destaque</p>
                <div className="flex flex-wrap gap-2">
                  {TAG_OPTIONS.map((t) => (
                    <button
                      key={t}
                      onClick={() => setSelectedTag(selectedTag === t ? null : t)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        selectedTag === t ? "border-neon bg-neon/10 text-neon" : "border-border text-muted-foreground hover:border-foreground"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Para quem */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Para quem</p>
                <div className="flex flex-wrap gap-2">
                  {FOR_WHOM_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSelectedForWhom(selectedForWhom === opt.value ? null : opt.value)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        selectedForWhom === opt.value ? "border-neon bg-neon/10 text-neon" : "border-border text-muted-foreground hover:border-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nível de experiência */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nível</p>
                <div className="flex flex-wrap gap-2">
                  {EXPERIENCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSelectedExperience(selectedExperience === opt.value ? null : opt.value)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        selectedExperience === opt.value ? "border-neon bg-neon/10 text-neon" : "border-border text-muted-foreground hover:border-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

              {/* Faixa de preço */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preço (R$)</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Mín"
                    value={minPreco}
                    onChange={(e) => setMinPreco(e.target.value)}
                    className="h-8 w-full rounded-md border border-border bg-secondary/50 px-2.5 text-xs focus:border-neon focus:outline-none"
                  />
                  <span className="text-xs text-muted-foreground">—</span>
                  <input
                    type="number"
                    placeholder="Máx"
                    value={maxPreco}
                    onChange={(e) => setMaxPreco(e.target.value)}
                    className="h-8 w-full rounded-md border border-border bg-secondary/50 px-2.5 text-xs focus:border-neon focus:outline-none"
                  />
                </div>
              </div>

              {/* Disponibilidade */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Disponibilidade</p>
                <label className="flex cursor-pointer items-center gap-2.5">
                  <div
                    onClick={() => setOnlyInStock(!onlyInStock)}
                    className={`relative h-5 w-9 rounded-full transition-colors ${
                      onlyInStock ? "bg-neon" : "bg-secondary"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        onlyInStock ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">Somente em estoque</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Chips de filtros ativos */}
        {(selectedTag || selectedForWhom || selectedExperience || minPreco !== "" || maxPreco !== "" || onlyInStock) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {selectedTag && (
              <span className="inline-flex items-center gap-1 rounded-full bg-neon/10 px-2.5 py-0.5 text-xs text-neon">
                {selectedTag}
                <button onClick={() => setSelectedTag(null)}><X className="h-3 w-3" /></button>
              </span>
            )}
            {selectedForWhom && (
              <span className="inline-flex items-center gap-1 rounded-full bg-neon/10 px-2.5 py-0.5 text-xs text-neon">
                {FOR_WHOM_OPTIONS.find((o) => o.value === selectedForWhom)?.label}
                <button onClick={() => setSelectedForWhom(null)}><X className="h-3 w-3" /></button>
              </span>
            )}
            {selectedExperience && (
              <span className="inline-flex items-center gap-1 rounded-full bg-neon/10 px-2.5 py-0.5 text-xs text-neon">
                {EXPERIENCE_OPTIONS.find((o) => o.value === selectedExperience)?.label}
                <button onClick={() => setSelectedExperience(null)}><X className="h-3 w-3" /></button>
              </span>
            )}
            {(minPreco !== "" || maxPreco !== "") && (
              <span className="inline-flex items-center gap-1 rounded-full bg-neon/10 px-2.5 py-0.5 text-xs text-neon">
                {minPreco !== "" ? `R$ ${minPreco}` : ""}
                {minPreco !== "" && maxPreco !== "" ? " — " : ""}
                {maxPreco !== "" ? `R$ ${maxPreco}` : ""}
                <button onClick={() => { setMinPreco(""); setMaxPreco(""); }}><X className="h-3 w-3" /></button>
              </span>
            )}
            {onlyInStock && (
              <span className="inline-flex items-center gap-1 rounded-full bg-neon/10 px-2.5 py-0.5 text-xs text-neon">
                Em estoque
                <button onClick={() => setOnlyInStock(false)}><X className="h-3 w-3" /></button>
              </span>
            )}
          </div>
        )}
      </section>

      {/* ── COLEÇÃO ───────────────────────────────────────────────────── */}
      {c.sections.collection.visible && (
        <section id="colecao" className="mx-auto max-w-7xl px-4 py-8 md:px-6">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-neon">
                {c.sections.collection.eyebrow}
              </p>
              <h2 className="mt-2 font-display text-3xl font-bold md:text-4xl">
                {c.sections.collection.title}
                {selectedCategory && (
                  <span className="ml-3 text-lg font-medium text-muted-foreground">
                    — {selectedCategory}
                  </span>
                )}
              </h2>
            </div>
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="text-xs text-neon hover:underline flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Ver todos
              </button>
            )}
          </div>
          {filteredProducts.length === 0 && !loadingProducts ? (
            <div className="py-12 text-center">
              <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm">Nenhum produto encontrado com os filtros selecionados.</p>
              <button onClick={clearAllFilters} className="mt-3 text-sm text-neon hover:underline">
                Limpar filtros
              </button>
            </div>
          ) : (
            <>
              {loadingProducts && (
                <div className="py-8 text-center">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-neon border-t-transparent" />
                </div>
              )}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredProducts.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="mt-10 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="rounded-md border border-border px-4 py-2 text-sm font-medium disabled:opacity-30 hover:border-neon hover:text-neon transition-colors"
                  >
                    ← Anterior
                  </button>
                  <span className="px-4 text-sm text-muted-foreground">
                    Página {page} de {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="rounded-md border border-border px-4 py-2 text-sm font-medium disabled:opacity-30 hover:border-neon hover:text-neon transition-colors"
                  >
                    Próxima →
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* ── MAIS VENDIDOS ─────────────────────────────────────────────── */}
      {c.sections.bestsellers.visible && bestsellers.length > 0 && (
        <section id="bestsellers" className="border-t border-border bg-card/30">
          <div className="mx-auto max-w-7xl px-4 py-16 md:px-6">
            <p className="text-xs uppercase tracking-widest text-neon">
              {c.sections.bestsellers.eyebrow}
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold md:text-4xl">
              {c.sections.bestsellers.title}
            </h2>
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {bestsellers.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── NOVIDADES ─────────────────────────────────────────────────── */}
      {c.sections.novidades.visible && novidades.length > 0 && (
        <section id="novidades" className="mx-auto max-w-7xl px-4 py-16 md:px-6">
          <p className="text-xs uppercase tracking-widest text-neon">
            {c.sections.novidades.eyebrow}
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold md:text-4xl">
            {c.sections.novidades.title}
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {novidades.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          <div className="mt-12 flex justify-center">
            <Link to="/" className="text-sm text-muted-foreground hover:text-neon">
              Voltar ao topo ↑
            </Link>
          </div>
        </section>
      )}
    </>
  );
}

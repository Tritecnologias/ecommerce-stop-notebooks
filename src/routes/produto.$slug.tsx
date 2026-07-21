import { createFileRoute, notFound, useRouter, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Star, ShoppingBag, Truck, ShieldCheck, RotateCcw, BadgeCheck, MessageSquare, Loader2, BellRing, BellOff, MapPin, Share2 } from "lucide-react";
import { WishlistButton } from "@/components/WishlistButton";
import { getProduct, PRODUCTS, dbProductToProduct, type Product } from "@/lib/products";
import { useCart, formatBRL } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { STORE } from "@/lib/store";
import { ProductCard } from "@/components/ProductCard";
import { getProducts, getProductBySlug } from "@/fns/products";
import { getProductReviews, getUserReview, createReview } from "@/fns/reviews";
import { subscribeStockNotification } from "@/fns/stock-notifications";
import { toast } from "sonner";
import type { Review, DbProduct } from "@/lib/types";

export const Route = createFileRoute("/produto/$slug")({
  loader: async ({ params }) => {
    const fallback = getProduct(params.slug);
    // Fetch from DB server-side so head() has real SEO fields for SSR
    let dbProduct: DbProduct | null = null;
    try {
      dbProduct = await getProductBySlug({ data: params.slug });
    } catch {
      // Fall back gracefully to mock data if DB is unavailable
    }
    return { slug: params.slug, fallbackProduct: fallback ?? null, dbProduct };
  },
  head: ({ loaderData }) => {
    const db = loaderData?.dbProduct;
    const fb = loaderData?.fallbackProduct;

    if (!db && !fb) return { meta: [{ title: "Produto — Secret Desire" }] };

    const name = db?.name ?? fb?.name ?? "";
    const shortDesc = db?.short_description ?? fb?.shortDescription ?? "";
    const firstImg = (db?.images ?? fb?.images ?? [])[0] ?? "";

    // Custom SEO fields take priority; fall back to product data
    const title = db?.meta_title?.trim() || `${name} — Secret Desire`;
    const description = db?.meta_description?.trim() || shortDesc;
    const image = db?.og_image?.trim() || firstImg;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:image", content: image },
        { property: "og:type", content: "product" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: image },
      ],
    };
  },
  component: ProductPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="font-display text-2xl font-bold">Produto não encontrado</h1>
      <Link to="/" className="mt-4 inline-block text-neon hover:underline">Voltar à loja</Link>
    </div>
  ),
});

// ─── Estrelas (leitura) ───────────────────────────────────────────────────────
function Stars({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "h-5 w-5" : size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${cls} ${i <= Math.round(rating) ? "fill-neon text-neon" : "text-muted-foreground"}`}
        />
      ))}
    </div>
  );
}

// ─── Seletor de estrelas (interativo) ─────────────────────────────────────────
function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          className="transition-transform hover:scale-110"
        >
          <Star
            className={`h-7 w-7 transition-colors ${
              i <= (hover || value) ? "fill-neon text-neon" : "text-muted-foreground"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

// ─── Barra de distribuição de notas ──────────────────────────────────────────
function RatingBar({ reviews }: { reviews: Review[] }) {
  const total = reviews.length;
  if (total === 0) return null;
  const avg = reviews.reduce((s, r) => s + r.rating, 0) / total;
  const counts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  return (
    <div className="flex gap-6 items-center">
      {/* Média grande */}
      <div className="flex-none text-center">
        <p className="font-display text-5xl font-bold text-neon">{avg.toFixed(1)}</p>
        <Stars rating={avg} size="md" />
        <p className="mt-1 text-xs text-muted-foreground">{total} avaliação{total !== 1 ? "ões" : ""}</p>
      </div>

      {/* Barras por nota */}
      <div className="flex-1 space-y-1.5">
        {counts.map(({ star, count }) => (
          <div key={star} className="flex items-center gap-2 text-xs">
            <span className="w-3 text-right text-muted-foreground">{star}</span>
            <Star className="h-3 w-3 fill-neon text-neon flex-none" />
            <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-neon transition-all"
                style={{ width: total > 0 ? `${(count / total) * 100}%` : "0%" }}
              />
            </div>
            <span className="w-4 text-muted-foreground">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Item de review ───────────────────────────────────────────────────────────
function ReviewItem({ review }: { review: Review }) {
  // Anonimiza: mostra "Cliente anônimo" ou "João S."
  const isAnonymous = review.customer_name === "Cliente anônimo";
  let displayName: string;
  if (isAnonymous) {
    displayName = "Cliente anônimo";
  } else {
    const nameParts = review.customer_name.trim().split(" ");
    displayName =
      nameParts.length > 1
        ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`
        : nameParts[0];
  }

  return (
    <div className="rounded-lg border border-border bg-card/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{displayName}</span>
            {review.verified_purchase && (
              <span className="flex items-center gap-1 rounded-full bg-neon/10 border border-neon/20 px-2 py-0.5 text-[10px] font-semibold text-neon">
                <BadgeCheck className="h-3 w-3" /> Compra verificada
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Stars rating={review.rating} size="sm" />
            <span className="text-xs text-muted-foreground">
              {new Date(review.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
          </div>
        </div>
      </div>
      {review.comment && (
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{review.comment}</p>
      )}
    </div>
  );
}

// ─── Formulário de avaliação ──────────────────────────────────────────────────
function ReviewForm({ slug, productId, onSuccess }: { slug: string; productId: string; onSuccess: () => void }) {
  const { user, profile } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const qc = useQueryClient();

  const { data: existingReview, isLoading: checkingExisting } = useQuery({
    queryKey: ["user-review", slug, user?.id],
    queryFn: () => getUserReview({ data: { productSlug: slug, userId: user!.id } }),
    enabled: !!user,
    staleTime: 60 * 1000,
  });

  const mut = useMutation({
    mutationFn: () =>
      createReview({
        data: {
          productSlug: slug,
          userId: user?.id,
          customerName: anonymous ? "Cliente anônimo" : (profile?.name ?? user?.email?.split("@")[0] ?? "Cliente"),
          customerEmail: user?.email ?? "",
          rating,
          comment: comment.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Avaliação enviada! Obrigado pelo feedback 🎉");
      qc.invalidateQueries({ queryKey: ["reviews", slug] });
      qc.invalidateQueries({ queryKey: ["product", slug] });
      qc.invalidateQueries({ queryKey: ["user-review", slug, user?.id] });
      onSuccess();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao enviar avaliação"),
  });

  if (!user) {
    return (
      <div className="rounded-lg border border-border bg-card/50 px-5 py-6 text-center">
        <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm font-medium">Faça login para avaliar este produto</p>
        <Link
          to="/login"
          className="mt-3 inline-block rounded-md bg-neon px-5 py-2 text-sm font-bold text-primary-foreground glow"
        >
          Entrar
        </Link>
      </div>
    );
  }

  if (checkingExisting) return null;

  if (existingReview) {
    return (
      <div className="rounded-lg border border-neon/20 bg-neon/5 px-5 py-4 text-sm text-neon">
        <BadgeCheck className="inline h-4 w-4 mr-1.5" />
        Você já avaliou este produto. Obrigado!
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="font-display font-bold mb-4">Escrever avaliação</h3>

      <div className="mb-4">
        <p className="text-xs text-muted-foreground mb-2">Sua nota *</p>
        <StarPicker value={rating} onChange={setRating} />
      </div>

      <div className="mb-4">
        <label className="text-xs text-muted-foreground block mb-1.5">Comentário (opcional)</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Conte sua experiência com este produto…"
          rows={4}
          maxLength={1000}
          className="w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-neon focus:outline-none focus:ring-1 focus:ring-neon transition resize-none"
        />
        <p className="text-right text-[10px] text-muted-foreground mt-1">{comment.length}/1000</p>
      </div>

      <div className="mb-4">
        <label className="flex cursor-pointer items-center gap-2.5">
          <div
            onClick={() => setAnonymous(!anonymous)}
            className={`relative h-5 w-9 rounded-full transition-colors ${
              anonymous ? "bg-neon" : "bg-secondary"
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                anonymous ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </div>
          <span className="text-xs text-muted-foreground">Publicar como anônimo</span>
        </label>
      </div>

      <button
        onClick={() => {
          if (rating === 0) { toast.error("Selecione uma nota de 1 a 5 estrelas"); return; }
          mut.mutate();
        }}
        disabled={mut.isPending || rating === 0}
        className="inline-flex items-center gap-2 rounded-md bg-neon px-5 py-2.5 text-sm font-bold text-primary-foreground glow disabled:opacity-50 disabled:cursor-not-allowed transition-transform hover:scale-[1.01]"
      >
        {mut.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando…</> : "Publicar avaliação"}
      </button>
    </div>
  );
}

// ─── Me avise quando disponível ───────────────────────────────────────────────
function BackInStockForm({ slug }: { slug: string }) {
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email ?? "");
  const [subscribed, setSubscribed] = useState(false);
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);

  const mut = useMutation({
    mutationFn: () => subscribeStockNotification({ data: { productSlug: slug, email: email.trim() } }),
    onSuccess: (res) => {
      if (res.alreadySubscribed) {
        setAlreadySubscribed(true);
      } else {
        setSubscribed(true);
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao se inscrever"),
  });

  if (subscribed) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-neon/20 bg-neon/5 px-5 py-4">
        <BellRing className="mt-0.5 h-5 w-5 flex-none text-neon" />
        <div>
          <p className="text-sm font-semibold text-neon">Tudo certo! 🎉</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Você receberá um email em <strong>{email}</strong> assim que este produto voltar ao estoque.
          </p>
        </div>
      </div>
    );
  }

  if (alreadySubscribed) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-border bg-card/50 px-5 py-4">
        <BellOff className="mt-0.5 h-5 w-5 flex-none text-muted-foreground" />
        <div>
          <p className="text-sm font-semibold">Você já está na lista</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Avisaremos em <strong>{email}</strong> quando o produto voltar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card/50 p-5">
      <div className="flex items-center gap-2 mb-1">
        <BellRing className="h-4 w-4 text-neon" />
        <p className="text-sm font-semibold">Me avise quando disponível</p>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Deixe seu email e avisaremos assim que este produto voltar ao estoque.
      </p>
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && email) mut.mutate(); }}
          placeholder="seu@email.com"
          className="flex-1 min-w-0 rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-neon focus:outline-none focus:ring-1 focus:ring-neon transition"
        />
        <button
          onClick={() => {
            if (!email.trim()) { toast.error("Informe seu email"); return; }
            mut.mutate();
          }}
          disabled={mut.isPending}
          className="inline-flex items-center gap-2 rounded-md bg-neon px-4 py-2 text-sm font-bold text-primary-foreground glow disabled:opacity-50 disabled:cursor-not-allowed transition-transform hover:scale-[1.02] whitespace-nowrap"
        >
          {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
          Avisar
        </button>
      </div>
    </div>
  );
}

// ─── Seção completa de avaliações ─────────────────────────────────────────────
function ReviewsSection({ slug, productId }: { slug: string; productId: string }) {
  const [showForm, setShowForm] = useState(false);

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["reviews", slug],
    queryFn: () => getProductReviews({ data: slug }),
    staleTime: 2 * 60 * 1000,
  });

  return (
    <section className="mt-20 border-t border-border pt-12">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <h2 className="font-display text-2xl font-bold">Avaliações dos clientes</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md border border-neon px-4 py-2 text-sm font-semibold text-neon hover:bg-neon/10 transition-colors"
        >
          {showForm ? "Cancelar" : "Escrever avaliação"}
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="mb-8">
          <ReviewForm
            slug={slug}
            productId={productId}
            onSuccess={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Sumário / barras */}
      {reviews.length > 0 && (
        <div className="mb-8 rounded-lg border border-border bg-card p-5">
          <RatingBar reviews={reviews} />
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-neon" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-lg border border-border bg-card/50 py-12 text-center">
          <Star className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">Ainda sem avaliações</p>
          <p className="text-xs text-muted-foreground mt-1">Seja o primeiro a avaliar este produto!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => <ReviewItem key={r.id} review={r} />)}
        </div>
      )}
    </section>
  );
}

// ─── Estimativa de prazo por estado ──────────────────────────────────────────
function deliveryDays(uf: string): string {
  if (uf === "SP") return "2–4 dias úteis";
  if (["RJ", "MG", "ES", "PR", "SC", "RS"].includes(uf)) return "3–6 dias úteis";
  if (["DF", "GO", "MT", "MS", "TO"].includes(uf)) return "5–8 dias úteis";
  if (["BA", "SE", "AL", "PE", "PB", "RN", "CE", "PI", "MA"].includes(uf)) return "6–10 dias úteis";
  return "8–12 dias úteis"; // Norte
}

// ─── Calculadora de frete ─────────────────────────────────────────────────────
function ShippingCalculator({ productPrice, qty }: { productPrice: number; qty: number }) {
  const [cep, setCep] = useState("");
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ city: string; uf: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const total = productPrice * qty;
  const freeShipping = total >= STORE.shipping.freeFrom;
  const remaining = Math.max(0, STORE.shipping.freeFrom - total);

  // Carrega CEP salvo no primeiro render (só client-side)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("@bs:cep");
      if (!saved) return;
      const clean = saved.replace(/\D/g, "");
      if (clean.length === 8) { setCep(saved); fetchCep(clean); }
    } catch { /* localStorage indisponível */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchCep(cleanCep: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      if (!res.ok) throw new Error("Serviço indisponível. Tente novamente.");
      const data: { erro?: boolean; localidade: string; uf: string } = await res.json();
      if (data.erro) throw new Error("CEP não encontrado.");
      setLocation({ city: data.localidade, uf: data.uf });
      try { localStorage.setItem("@bs:cep", `${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}`); } catch { /* ok */ }
    } catch (e) {
      setError(e instanceof Error ? e.message : "CEP não encontrado.");
      setLocation(null);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
    const formatted = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
    setCep(formatted);
    setError(null);
    if (digits.length === 8) fetchCep(digits);
    else setLocation(null);
  }

  const days = location ? deliveryDays(location.uf) : "";

  return (
    <div className="mt-4 rounded-lg border border-border bg-card/50 p-4">
      {/* Cabeçalho */}
      <div className="mb-3 flex items-center gap-2">
        <Truck className="h-4 w-4 flex-none text-neon" />
        <p className="text-sm font-semibold">Calcular frete</p>
      </div>

      {/* Input CEP */}
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={cep}
          onChange={handleChange}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const clean = cep.replace(/\D/g, "");
              if (clean.length === 8) fetchCep(clean);
              else setError("Digite um CEP com 8 dígitos.");
            }
          }}
          placeholder="00000-000"
          maxLength={9}
          className="h-9 flex-1 rounded-md border border-border bg-secondary/50 px-3 font-mono text-sm placeholder:text-muted-foreground focus:border-neon focus:outline-none focus:ring-1 focus:ring-neon transition"
        />
        <button
          type="button"
          onClick={() => {
            const clean = cep.replace(/\D/g, "");
            if (clean.length === 8) fetchCep(clean);
            else setError("Digite um CEP com 8 dígitos.");
          }}
          disabled={loading}
          className="flex h-9 items-center gap-1.5 rounded-md border border-border bg-secondary px-4 text-xs font-semibold transition hover:border-neon hover:text-neon disabled:opacity-40"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Calcular"}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      {/* Resultado */}
      {location && (
        <div className="mt-3 space-y-2">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 flex-none" />
            Entregando em{" "}
            <strong className="text-foreground">{location.city} – {location.uf}</strong>
            <button
              type="button"
              onClick={() => { setCep(""); setLocation(null); setError(null); }}
              className="ml-auto text-[10px] underline underline-offset-2 hover:text-neon transition-colors"
            >
              Alterar
            </button>
          </p>

          {freeShipping ? (
            <div className="flex items-center justify-between rounded-md border border-neon/30 bg-neon/10 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 flex-none text-neon" />
                <div>
                  <p className="text-xs font-bold text-neon">Frete Grátis</p>
                  <p className="text-[11px] text-muted-foreground">Envio padrão · {days}</p>
                </div>
              </div>
              <span className="text-sm font-bold text-neon">Grátis</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 flex-none text-muted-foreground" />
                  <div>
                    <p className="text-xs font-semibold">Envio padrão</p>
                    <p className="text-[11px] text-muted-foreground">{days}</p>
                  </div>
                </div>
                <span className="text-sm font-semibold">{formatBRL(STORE.shipping.flatRate)}</span>
              </div>
              <p className="pl-1 text-[11px] text-muted-foreground">
                Adicione mais{" "}
                <span className="font-semibold text-neon">{formatBRL(remaining)}</span>
                {" "}ao carrinho para ganhar frete grátis.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Link "não sei meu CEP" */}
      {!location && !loading && (
        <a
          href="https://buscacepinter.correios.com.br/app/endereco/index.php"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block text-[10px] text-muted-foreground transition-colors hover:text-neon"
        >
          Não sei meu CEP →
        </a>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
function ProductPage() {
  const { slug, fallbackProduct, dbProduct: loaderDbProduct } = Route.useLoaderData() as {
    slug: string;
    fallbackProduct: Product | null;
    dbProduct: DbProduct | null;
  };
  const { add } = useCart();
  const router = useRouter();

  const { data: dbProduct } = useQuery({
    queryKey: ["product", slug],
    queryFn: () => getProductBySlug({ data: slug }),
    // Seed with server-fetched data so there's no client-side flash
    initialData: loaderDbProduct ?? undefined,
    staleTime: 5 * 60 * 1000,
  });

  const product: Product | null = dbProduct
    ? dbProductToProduct(dbProduct)
    : fallbackProduct;

  const { data: allDbProducts } = useQuery({
    queryKey: ["products"],
    queryFn: () => getProducts(),
    staleTime: 5 * 60 * 1000,
  });

  const allProducts = allDbProducts ? allDbProducts.map(dbProductToProduct) : PRODUCTS;
  const related = allProducts.filter((p) => p.slug !== slug).slice(0, 3);

  const [size, setSize] = useState(product?.sizes[0] ?? "100ml");
  const [activeImg, setActiveImg] = useState(0);
  const [qty, setQty] = useState(1);

  if (!product) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-bold">Produto não encontrado</h1>
        <Link to="/" className="mt-4 inline-block text-neon hover:underline">Voltar à loja</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <nav className="mb-6 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-neon">Loja</Link> / <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="grid gap-10 md:grid-cols-2">
        <div>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <img src={product.images[activeImg]} alt={product.name} className="aspect-square w-full object-cover" />
          </div>
          <div className="mt-3 flex gap-3">
            {product.images.map((src, i) => (
              <button
                key={i}
                onClick={() => setActiveImg(i)}
                className={`h-20 w-20 overflow-hidden rounded-md border ${i === activeImg ? "border-neon glow" : "border-border"}`}
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        <div className="animate-fade-in">
          <p className="text-xs uppercase tracking-widest text-neon">{product.category}</p>
          <h1 className="mt-2 font-display text-4xl font-bold md:text-5xl">{product.name}</h1>

          {/* Rating com link para seção de reviews */}
          <a href="#avaliacoes" className="mt-3 flex items-center gap-2 text-sm hover:opacity-80 transition-opacity w-fit">
            <Stars rating={product.rating} size="md" />
            <span className="text-muted-foreground">
              {product.rating > 0 ? product.rating.toFixed(1) : "Sem avaliações"}{" "}
              {product.reviewCount > 0 && `· ${product.reviewCount} avaliação${product.reviewCount !== 1 ? "ões" : ""}`}
            </span>
          </a>

          <div className="mt-6 flex items-end gap-3">
            {product.oldPrice && <p className="text-sm text-muted-foreground line-through">{formatBRL(product.oldPrice)}</p>}
            <p className="font-display text-4xl font-bold text-neon neon-text">{formatBRL(product.price)}</p>
            {/* Compartilhar no WhatsApp */}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Olhei esse produto e lembrei de você! 😍\n\n*${product.name}* — ${formatBRL(product.price)}\n\n${typeof window !== "undefined" ? window.location.href : ""}`)}` }
              target="_blank"
              rel="noopener noreferrer"
              title="Compartilhar no WhatsApp"
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-[#25D366]/40 bg-[#25D366]/10 px-3 py-2 text-xs font-semibold text-[#25D366] transition-colors hover:bg-[#25D366]/20"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Compartilhar</span>
            </a>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">ou 3x de {formatBRL(product.price / 3)} sem juros</p>

          <p className="mt-6 text-sm text-muted-foreground">{product.description}</p>

          <div className="mt-6">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Características</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {product.notes.map((n) => (
                <span key={n} className="rounded-full border border-border px-3 py-1 text-xs">{n}</span>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Variação</p>
            <div className="mt-2 flex gap-2">
              {product.sizes.map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={`min-w-16 rounded-md border px-4 py-2 text-sm font-semibold transition ${
                    size === s ? "border-neon bg-neon/10 text-neon" : "border-border hover:border-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {product.stock === 0 ? (
            /* ── Esgotado ───────────────────────────────────────────────── */
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-bold tracking-wide text-destructive uppercase">
                  Esgotado
                </span>
                <span className="text-xs text-muted-foreground">Este produto está temporariamente indisponível</span>
              </div>
              <BackInStockForm slug={slug} />
            </div>
          ) : (
            /* ── Disponível ─────────────────────────────────────────────── */
            <>
              <div className="mt-6 flex items-center gap-3">
                <div className="inline-flex items-center rounded-md border border-border">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-3 py-2 hover:bg-secondary">−</button>
                  <span className="min-w-10 text-center text-sm">{qty}</span>
                  <button onClick={() => setQty(qty + 1)} className="px-3 py-2 hover:bg-secondary">+</button>
                </div>
                <button
                  onClick={() => add(product.slug, size, qty)}
                  className="flex-1 rounded-md border border-neon px-6 py-3 text-sm font-bold uppercase tracking-wide text-neon transition hover:bg-neon/10"
                >
                  <ShoppingBag className="mr-2 inline h-4 w-4" />
                  Adicionar
                </button>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => { add(product.slug, size, qty); router.navigate({ to: "/checkout" }); }}
                  className="flex-1 rounded-md bg-neon py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-transform hover:scale-[1.01] glow"
                >
                  Comprar agora
                </button>
                <WishlistButton
                  productId={product.id}
                  productName={product.name}
                  variant="page"
                />
              </div>

              {/* Calculadora de frete */}
              <ShippingCalculator productPrice={product.price} qty={qty} />
            </>
          )}

          <div className="mt-8 grid grid-cols-3 gap-4 border-t border-border pt-6 text-center text-xs text-muted-foreground">
            <div><Truck className="mx-auto mb-1 h-5 w-5 text-neon" /> Envio 24h</div>
            <div><ShieldCheck className="mx-auto mb-1 h-5 w-5 text-neon" /> Compra segura</div>
            <div><RotateCcw className="mx-auto mb-1 h-5 w-5 text-neon" /> Troca grátis</div>
          </div>
        </div>
      </div>

      {/* Avaliações */}
      <div id="avaliacoes">
        <ReviewsSection slug={slug} productId={product.id} />
      </div>

      {/* Combina com — cross-sell complementar */}
      <section className="mt-20">
        <h2 className="font-display text-2xl font-bold">Combina com</h2>
        <p className="mt-1 text-sm text-muted-foreground">Produtos que complementam sua escolha</p>
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {related.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>
    </div>
  );
}

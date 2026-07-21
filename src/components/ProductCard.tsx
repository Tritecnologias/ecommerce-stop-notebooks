import { Link, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ShoppingBag, Star, X, Minus, Plus, Zap, Share2 } from "lucide-react";
import { type Product } from "@/lib/products";
import { useCart, formatBRL } from "@/lib/cart";
import { WishlistButton } from "@/components/WishlistButton";

const tagStyles: Record<string, string> = {
  "Mais Vendido": "bg-neon text-primary-foreground",
  "Lançamento": "bg-foreground text-background",
  "Frete Grátis": "bg-secondary text-neon border border-neon/40",
};

// ─── Modal de compra rápida ───────────────────────────────────────────────────

function QuickBuyModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const { add } = useCart();
  const router = useRouter();
  const [size, setSize] = useState(product.sizes[0] ?? "");
  const [qty, setQty] = useState(1);

  // Fecha com Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  function handleAdd() {
    add(product.slug, size, qty);
    onClose();
  }

  function handleBuyNow() {
    add(product.slug, size, qty);
    onClose();
    router.navigate({ to: "/checkout" });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle mobile */}
        <div className="flex justify-center pt-3 pb-0 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-border/70" />
        </div>

        {/* Fechar */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-5 pt-4">
          {/* Cabeçalho do produto */}
          <div className="mb-5 flex gap-4">
            <div className="h-20 w-20 flex-none overflow-hidden rounded-xl border border-border bg-secondary">
              <img
                src={product.images[0]}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {product.category}
              </p>
              <h3 className="mt-0.5 line-clamp-2 font-display text-base font-bold leading-tight">
                {product.name}
              </h3>
              <div className="mt-1.5 flex items-baseline gap-2">
                {product.oldPrice && (
                  <span className="text-xs text-muted-foreground line-through">
                    {formatBRL(product.oldPrice)}
                  </span>
                )}
                <span className="font-display text-xl font-bold text-neon neon-text">
                  {formatBRL(product.price)}
                </span>
              </div>
            </div>
          </div>

          {/* Tamanho — só exibe se houver mais de um */}
          {product.sizes.length > 1 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tamanho
              </p>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSize(s)}
                    className={`min-w-[52px] rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors ${
                      size === s
                        ? "border-neon bg-neon/10 text-neon"
                        : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantidade */}
          <div className="mb-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Quantidade
            </p>
            <div className="inline-flex items-center rounded-md border border-border">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="px-3 py-2 transition-colors hover:bg-secondary"
                aria-label="Diminuir"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-10 text-center text-sm font-bold tabular-nums">{qty}</span>
              <button
                onClick={() => setQty(qty + 1)}
                className="px-3 py-2 transition-colors hover:bg-secondary"
                aria-label="Aumentar"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Ações */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleBuyNow}
              className="flex items-center justify-center gap-2 rounded-lg bg-neon py-3 text-sm font-bold text-primary-foreground glow transition-opacity hover:opacity-90 active:scale-[0.98]"
            >
              <Zap className="h-4 w-4" />
              Comprar agora
            </button>
            <button
              onClick={handleAdd}
              className="flex items-center justify-center gap-2 rounded-lg border border-neon py-3 text-sm font-bold text-neon transition-colors hover:bg-neon/10 active:scale-[0.98]"
            >
              <ShoppingBag className="h-4 w-4" />
              Adicionar ao carrinho
            </button>

            {/* Linha inferior: compartilhar + ver produto */}
            <div className="flex items-center justify-between pt-0.5">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Olhei esse produto e lembrei de você! 😍\n\n*${product.name}* — R$ ${product.price.toFixed(2).replace(".", ",")}\n\n${typeof window !== "undefined" ? window.location.origin : ""}/produto/${product.slug}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-[#25D366] transition-colors hover:bg-[#25D366]/10"
              >
                <Share2 className="h-3.5 w-3.5" />
                Compartilhar
              </a>
              <Link
                to="/produto/$slug"
                params={{ slug: product.slug }}
                onClick={onClose}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Ver produto completo →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Card do produto ──────────────────────────────────────────────────────────

export function ProductCard({ product }: { product: Product }) {
  const [quickBuyOpen, setQuickBuyOpen] = useState(false);

  return (
    <>
      <div className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-neon/50 hover:glow">

        {/* ── Área da imagem ──────────────────────────────────────────────── */}
        <div className="relative aspect-square overflow-hidden bg-secondary">
          {/* Link cobre toda a área da imagem */}
          <Link
            to="/produto/$slug"
            params={{ slug: product.slug }}
            className="absolute inset-0 z-0"
          >
            {product.tag && (
              <span
                className={`absolute left-3 top-3 z-10 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${tagStyles[product.tag]}`}
              >
                {product.tag}
              </span>
            )}
            <img
              src={product.images[0]}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover hover-zoom"
            />
          </Link>

          {/* Favoritar — canto superior direito (acima do link) */}
          <div className="absolute right-2 top-2 z-20 opacity-0 transition-opacity group-hover:opacity-100">
            <WishlistButton productId={product.id} productName={product.name} variant="card" />
          </div>

          {/* Overlay "Compra Rápida" — desliza de baixo ao hover */}
          <button
            onClick={() => setQuickBuyOpen(true)}
            className="absolute bottom-0 left-0 right-0 z-20 flex translate-y-full items-center justify-center gap-2 bg-black/85 py-2.5 text-xs font-bold uppercase tracking-widest text-white backdrop-blur-sm transition-all duration-200 group-hover:translate-y-0 hover:bg-neon/90"
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            Compra Rápida
          </button>
        </div>

        {/* ── Informações ─────────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {product.category}
          </p>
          <Link
            to="/produto/$slug"
            params={{ slug: product.slug }}
            className="mt-1 transition-colors hover:text-neon"
          >
            <h3 className="font-display text-base font-semibold leading-tight">{product.name}</h3>
          </Link>
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{product.shortDescription}</p>

          {/* Estrelas */}
          {product.reviewCount > 0 && (
            <div className="mt-2 flex items-center gap-1">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className={`h-3 w-3 ${
                      i <= Math.round(product.rating)
                        ? "fill-neon text-neon"
                        : "text-muted-foreground/40"
                    }`}
                  />
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground">({product.reviewCount})</span>
            </div>
          )}

          {/* Preço + botão quick-buy */}
          <div className="mt-3 flex items-end justify-between gap-2">
            <div>
              {product.oldPrice && (
                <p className="text-xs text-muted-foreground line-through">
                  {formatBRL(product.oldPrice)}
                </p>
              )}
              <p className="font-display text-lg font-bold text-neon neon-text">
                {formatBRL(product.price)}
              </p>
            </div>
            <button
              onClick={() => setQuickBuyOpen(true)}
              aria-label="Compra rápida"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-neon text-primary-foreground glow transition-transform hover:scale-105 active:scale-95"
            >
              <ShoppingBag className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {quickBuyOpen && (
        <QuickBuyModal product={product} onClose={() => setQuickBuyOpen(false)} />
      )}
    </>
  );
}

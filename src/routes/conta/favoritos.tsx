import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Loader2, ShoppingBag, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getUserWishlist } from "@/fns/wishlist";
import { useWishlist } from "@/lib/useWishlist";
import { formatBRL } from "@/lib/cart";
import { useCart } from "@/lib/cart";
import { dbProductToProduct } from "@/lib/products";
import { toast } from "sonner";

export const Route = createFileRoute("/conta/favoritos")({
  head: () => ({ meta: [{ title: "Meus favoritos — Secret Desire" }] }),
  component: Favoritos,
});

function Favoritos() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const { add } = useCart();
  const { toggle } = useWishlist();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["wishlist", user?.id],
    queryFn: () => getUserWishlist({ data: user!.id }),
    enabled: !!user,
    staleTime: 30 * 1000,
  });

  const handleRemove = (productId: string, productName: string) => {
    toggle({ productId, inWishlist: true });
    toast(`"${productName}" removido dos favoritos`, { icon: "🤍" });
  };

  const handleAddToCart = (item: (typeof items)[0]) => {
    const product = dbProductToProduct(item);
    add(product.slug, product.sizes[0]);
    toast.success(`"${product.name}" adicionado ao carrinho`);
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
      {/* Cabeçalho */}
      <div className="mb-8 flex items-center gap-3">
        <Heart className="h-7 w-7 fill-rose-500 text-rose-500" />
        <div>
          <h1 className="font-display text-3xl font-bold">Meus favoritos</h1>
          {!isLoading && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {items.length === 0
                ? "Nenhum produto salvo ainda"
                : `${items.length} produto${items.length !== 1 ? "s" : ""} salvo${items.length !== 1 ? "s" : ""}`}
            </p>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-neon" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && items.length === 0 && (
        <div className="flex flex-col items-center rounded-lg border border-border bg-card py-20 text-center">
          <Heart className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h2 className="font-display text-xl font-bold">Lista vazia</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Salve os produtos que você gosta tocando no coração para comprar depois.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-neon px-6 py-2.5 text-sm font-bold text-primary-foreground glow transition-transform hover:scale-[1.01]"
          >
            Explorar produtos
          </Link>
        </div>
      )}

      {/* Grid de produtos */}
      {!isLoading && items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const product = dbProductToProduct(item);
            return (
              <div
                key={item.wishlist_id}
                className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-neon/40"
              >
                {/* Imagem */}
                <Link
                  to="/produto/$slug"
                  params={{ slug: product.slug }}
                  className="relative aspect-square overflow-hidden bg-secondary"
                >
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {product.stock === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <span className="rounded-full border border-destructive/60 bg-background px-3 py-1 text-xs font-bold text-destructive">
                        Esgotado
                      </span>
                    </div>
                  )}
                </Link>

                {/* Info */}
                <div className="flex flex-1 flex-col p-4">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {product.category}
                  </p>
                  <Link
                    to="/produto/$slug"
                    params={{ slug: product.slug }}
                    className="mt-1 font-display text-base font-semibold leading-tight hover:text-neon transition-colors"
                  >
                    {product.name}
                  </Link>
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                    {product.shortDescription}
                  </p>

                  <div className="mt-3 flex items-center justify-between gap-2">
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

                    <div className="flex gap-1.5">
                      {/* Remover dos favoritos */}
                      <button
                        onClick={() => handleRemove(item.id, product.name)}
                        title="Remover dos favoritos"
                        className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-rose-400 transition hover:border-rose-400 hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>

                      {/* Adicionar ao carrinho */}
                      <button
                        onClick={() => handleAddToCart(item)}
                        disabled={product.stock === 0}
                        title="Adicionar ao carrinho"
                        className="flex h-9 w-9 items-center justify-center rounded-md bg-neon text-primary-foreground transition-transform hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ShoppingBag className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Data de adição */}
                  <p className="mt-3 text-[10px] text-muted-foreground/60">
                    Salvo em{" "}
                    {new Date(item.wishlisted_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

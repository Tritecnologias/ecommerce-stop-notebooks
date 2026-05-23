import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { type Product } from "@/lib/products";
import { useCart, formatBRL } from "@/lib/cart";

const tagStyles: Record<string, string> = {
  "Mais Vendido": "bg-neon text-primary-foreground",
  "Lançamento": "bg-foreground text-background",
  "Frete Grátis": "bg-secondary text-neon border border-neon/40",
};

export function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-neon/50 hover:glow">
      <Link
        to="/produto/$slug"
        params={{ slug: product.slug }}
        className="relative aspect-square overflow-hidden bg-secondary"
      >
        {product.tag && (
          <span className={`absolute left-3 top-3 z-10 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${tagStyles[product.tag]}`}>
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

      <div className="flex flex-1 flex-col p-4">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{product.category}</p>
        <Link to="/produto/$slug" params={{ slug: product.slug }} className="mt-1 hover:text-neon transition-colors">
          <h3 className="font-display text-base font-semibold leading-tight">{product.name}</h3>
        </Link>
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{product.shortDescription}</p>

        <div className="mt-3 flex items-end justify-between gap-2">
          <div>
            {product.oldPrice && (
              <p className="text-xs text-muted-foreground line-through">{formatBRL(product.oldPrice)}</p>
            )}
            <p className="font-display text-lg font-bold text-neon neon-text">{formatBRL(product.price)}</p>
          </div>
          <button
            onClick={(e) => { e.preventDefault(); add(product.id, product.sizes[0]); }}
            aria-label="Adicionar ao carrinho"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-neon text-primary-foreground transition-transform hover:scale-105 active:scale-95"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

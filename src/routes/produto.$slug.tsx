import { createFileRoute, notFound, useRouter, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Star, ShoppingBag, Truck, ShieldCheck, RotateCcw } from "lucide-react";
import { getProduct, PRODUCTS, type Product } from "@/lib/products";
import { useCart, formatBRL } from "@/lib/cart";
import { ProductCard } from "@/components/ProductCard";

export const Route = createFileRoute("/produto/$slug")({
  loader: ({ params }) => {
    const product = getProduct(params.slug);
    if (!product) throw notFound();
    return { product };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.product.name} — BodySplashers` },
          { name: "description", content: loaderData.product.shortDescription },
          { property: "og:title", content: `${loaderData.product.name} — BodySplashers` },
          { property: "og:description", content: loaderData.product.shortDescription },
          { property: "og:image", content: loaderData.product.images[0] },
        ]
      : [],
  }),
  component: ProductPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="font-display text-2xl font-bold">Produto não encontrado</h1>
      <Link to="/" className="mt-4 inline-block text-neon hover:underline">Voltar à loja</Link>
    </div>
  ),
});

function ProductPage() {
  const { product } = Route.useLoaderData() as { product: Product };
  const { add } = useCart();
  const router = useRouter();
  const [size, setSize] = useState(product.sizes[0]);
  const [activeImg, setActiveImg] = useState(0);
  const [qty, setQty] = useState(1);

  const related = PRODUCTS.filter((p) => p.id !== product.id).slice(0, 3);

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

          <div className="mt-3 flex items-center gap-2 text-sm">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`h-4 w-4 ${i < Math.round(product.rating) ? "fill-neon text-neon" : "text-muted-foreground"}`} />
              ))}
            </div>
            <span className="text-muted-foreground">{product.rating} · {product.reviewCount} avaliações</span>
          </div>

          <div className="mt-6 flex items-end gap-3">
            {product.oldPrice && <p className="text-sm text-muted-foreground line-through">{formatBRL(product.oldPrice)}</p>}
            <p className="font-display text-4xl font-bold text-neon neon-text">{formatBRL(product.price)}</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">ou 3x de {formatBRL(product.price / 3)} sem juros</p>

          <p className="mt-6 text-sm text-muted-foreground">{product.description}</p>

          <div className="mt-6">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Notas olfativas</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {product.notes.map((n) => (
                <span key={n} className="rounded-full border border-border px-3 py-1 text-xs">{n}</span>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Tamanho</p>
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

          <div className="mt-6 flex items-center gap-3">
            <div className="inline-flex items-center rounded-md border border-border">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-3 py-2 hover:bg-secondary">−</button>
              <span className="min-w-10 text-center text-sm">{qty}</span>
              <button onClick={() => setQty(qty + 1)} className="px-3 py-2 hover:bg-secondary">+</button>
            </div>
            <button
              onClick={() => add(product.id, size, qty)}
              className="flex-1 rounded-md border border-neon px-6 py-3 text-sm font-bold uppercase tracking-wide text-neon transition hover:bg-neon/10"
            >
              <ShoppingBag className="mr-2 inline h-4 w-4" />
              Adicionar
            </button>
          </div>

          <button
            onClick={() => { add(product.id, size, qty); router.navigate({ to: "/checkout" }); }}
            className="mt-3 w-full rounded-md bg-neon py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-transform hover:scale-[1.01] glow"
          >
            Comprar agora
          </button>

          <div className="mt-8 grid grid-cols-3 gap-4 border-t border-border pt-6 text-center text-xs text-muted-foreground">
            <div><Truck className="mx-auto mb-1 h-5 w-5 text-neon" /> Envio 24h</div>
            <div><ShieldCheck className="mx-auto mb-1 h-5 w-5 text-neon" /> Compra segura</div>
            <div><RotateCcw className="mx-auto mb-1 h-5 w-5 text-neon" /> Troca grátis</div>
          </div>
        </div>
      </div>

      <section className="mt-20">
        <h2 className="font-display text-2xl font-bold">Você também pode gostar</h2>
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {related.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>
    </div>
  );
}

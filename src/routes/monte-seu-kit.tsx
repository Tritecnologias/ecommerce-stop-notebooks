import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag, X, Percent, Gift, Sparkles } from "lucide-react";
import { getProducts } from "@/fns/products";
import { dbProductToProduct, type Product } from "@/lib/products";
import { useCart, formatBRL } from "@/lib/cart";
import { toast } from "sonner";

export const Route = createFileRoute("/monte-seu-kit")({
  head: () => ({ meta: [{ title: "Monte seu Kit — Secret Desire" }] }),
  component: MonteSeuKit,
});

// Desconto progressivo
const DISCOUNTS = [
  { min: 2, percent: 5, label: "5% OFF" },
  { min: 3, percent: 10, label: "10% OFF" },
  { min: 4, percent: 15, label: "15% OFF" },
  { min: 5, percent: 20, label: "20% OFF" },
];

function getDiscount(count: number) {
  for (let i = DISCOUNTS.length - 1; i >= 0; i--) {
    if (count >= DISCOUNTS[i].min) return DISCOUNTS[i];
  }
  return null;
}

function getNextDiscount(count: number) {
  for (const d of DISCOUNTS) {
    if (count < d.min) return d;
  }
  return null;
}

function MonteSeuKit() {
  const { add } = useCart();
  const [selected, setSelected] = useState<Product[]>([]);

  const { data: dbProducts, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => getProducts(),
    staleTime: 5 * 60 * 1000,
  });

  const products = dbProducts ? dbProducts.map(dbProductToProduct) : [];
  const discount = getDiscount(selected.length);
  const nextDiscount = getNextDiscount(selected.length);

  const subtotal = selected.reduce((sum, p) => sum + p.price, 0);
  const discountAmount = discount ? subtotal * (discount.percent / 100) : 0;
  const total = subtotal - discountAmount;

  function toggleProduct(product: Product) {
    if (selected.find((p) => p.id === product.id)) {
      setSelected(selected.filter((p) => p.id !== product.id));
    } else {
      setSelected([...selected, product]);
    }
  }

  function addKitToCart() {
    if (selected.length < 2) {
      toast.error("Selecione pelo menos 2 produtos para montar seu kit");
      return;
    }
    for (const p of selected) {
      add(p.slug, p.sizes[0] ?? "Padrão", 1);
    }
    toast.success(`Kit com ${selected.length} itens adicionado ao carrinho! ${discount?.label ?? ""}`);
    setSelected([]);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
      {/* Header */}
      <div className="text-center mb-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-neon/40 bg-neon/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-neon mb-4">
          <Gift className="h-3.5 w-3.5" /> Desconto progressivo
        </span>
        <h1 className="font-display text-4xl font-bold md:text-5xl">Monte seu Kit</h1>
        <p className="mt-3 text-muted-foreground max-w-md mx-auto">
          Escolha seus produtos favoritos e ganhe desconto progressivo. Quanto mais itens, maior o desconto!
        </p>
      </div>

      {/* Barra de progresso de desconto */}
      <div className="mb-8 rounded-xl border border-border bg-card/50 p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">
            {selected.length} {selected.length === 1 ? "item selecionado" : "itens selecionados"}
          </span>
          {discount && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-neon/10 border border-neon/30 px-3 py-1 text-xs font-bold text-neon">
              <Percent className="h-3 w-3" /> {discount.label}
            </span>
          )}
        </div>

        <div className="flex gap-1">
          {DISCOUNTS.map((d, i) => (
            <div key={i} className="flex-1">
              <div
                className={`h-2 rounded-full transition-colors ${
                  selected.length >= d.min ? "bg-neon" : "bg-secondary"
                }`}
              />
              <p className={`mt-1.5 text-center text-[10px] font-medium ${
                selected.length >= d.min ? "text-neon" : "text-muted-foreground"
              }`}>
                {d.min}+ itens = {d.label}
              </p>
            </div>
          ))}
        </div>

        {nextDiscount && selected.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground text-center">
            <Sparkles className="inline h-3 w-3 text-neon mr-1" />
            Adicione mais {nextDiscount.min - selected.length} {nextDiscount.min - selected.length === 1 ? "item" : "itens"} para ganhar {nextDiscount.label}!
          </p>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Grid de produtos */}
        <div>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-lg bg-secondary" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {products.filter((p) => p.stock > 0).map((product) => {
                const isSelected = selected.some((p) => p.id === product.id);
                return (
                  <button
                    key={product.id}
                    onClick={() => toggleProduct(product)}
                    className={`relative flex flex-col overflow-hidden rounded-lg border text-left transition-all ${
                      isSelected
                        ? "border-neon ring-2 ring-neon/30 bg-neon/5"
                        : "border-border hover:border-neon/50"
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-neon text-primary-foreground">
                        <span className="text-xs font-bold">✓</span>
                      </div>
                    )}
                    <div className="aspect-square overflow-hidden bg-secondary">
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {product.category}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold line-clamp-2">{product.name}</p>
                      <p className="mt-1 font-display text-sm font-bold text-neon">
                        {formatBRL(product.price)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Resumo do kit */}
        <div className="lg:sticky lg:top-20 h-fit">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-display font-bold text-lg mb-4">Seu Kit</h3>

            {selected.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Selecione pelo menos 2 produtos para montar seu kit com desconto.
              </p>
            ) : (
              <>
                <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                  {selected.map((p) => (
                    <div key={p.id} className="flex items-center gap-3">
                      <img
                        src={p.images[0]}
                        alt={p.name}
                        className="h-10 w-10 rounded-md object-cover border border-border"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{formatBRL(p.price)}</p>
                      </div>
                      <button
                        onClick={() => toggleProduct(p)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="border-t border-border pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatBRL(subtotal)}</span>
                  </div>
                  {discount && (
                    <div className="flex justify-between text-sm text-neon font-medium">
                      <span>Desconto ({discount.label})</span>
                      <span>-{formatBRL(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold pt-2 border-t border-border">
                    <span>Total</span>
                    <span className="text-neon neon-text">{formatBRL(total)}</span>
                  </div>
                </div>

                <button
                  onClick={addKitToCart}
                  disabled={selected.length < 2}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-neon py-3 text-sm font-bold text-primary-foreground glow disabled:opacity-50 disabled:cursor-not-allowed transition-transform hover:scale-[1.01]"
                >
                  <ShoppingBag className="h-4 w-4" />
                  Adicionar kit ao carrinho
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

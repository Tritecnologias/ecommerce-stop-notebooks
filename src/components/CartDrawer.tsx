import { useNavigate } from "@tanstack/react-router";
import { X, Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useCart, formatBRL } from "@/lib/cart";
import { STORE } from "@/lib/store";

export function CartDrawer() {
  const { isOpen, close, detailed, subtotal, setQty, remove } = useCart();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const remaining = Math.max(0, STORE.shipping.freeFrom - subtotal);
  const progress = Math.min(100, (subtotal / STORE.shipping.freeFrom) * 100);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm animate-fade-in" onClick={close} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-border bg-card animate-slide-in-right">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-semibold">Seu carrinho</h2>
          <button onClick={close} className="rounded-md p-2 hover:bg-secondary" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        {detailed.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <ShoppingBag className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Seu carrinho está vazio.</p>
            <button onClick={close} className="mt-2 rounded-md bg-neon px-4 py-2 text-sm font-semibold text-primary-foreground">
              Continuar comprando
            </button>
          </div>
        ) : (
          <>
            <div className="border-b border-border px-5 py-3">
              {remaining > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Faltam <span className="font-semibold text-neon">{formatBRL(remaining)}</span> para <span className="text-foreground">frete grátis</span>
                </p>
              ) : (
                <p className="text-xs font-semibold text-neon">🎉 Você ganhou frete grátis!</p>
              )}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-neon transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <ul className="space-y-4">
                {detailed.map(({ item, product, lineTotal }) => (
                  <li key={`${item.productId}-${item.size}`} className="flex gap-3">
                    <img src={product.images[0]} alt={product.name} className="h-20 w-20 flex-none rounded-md object-cover" />
                    <div className="flex flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold leading-tight">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{item.size}</p>
                        </div>
                        <button onClick={() => remove(item.productId, item.size)} className="text-muted-foreground hover:text-destructive" aria-label="Remover">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-auto flex items-center justify-between">
                        <div className="inline-flex items-center rounded-md border border-border">
                          <button onClick={() => setQty(item.productId, item.size, item.quantity - 1)} className="px-2 py-1 hover:bg-secondary" aria-label="-"><Minus className="h-3 w-3" /></button>
                          <span className="min-w-8 text-center text-sm">{item.quantity}</span>
                          <button onClick={() => setQty(item.productId, item.size, item.quantity + 1)} className="px-2 py-1 hover:bg-secondary" aria-label="+"><Plus className="h-3 w-3" /></button>
                        </div>
                        <p className="text-sm font-bold text-neon">{formatBRL(lineTotal)}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-border bg-background/40 px-5 py-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Subtotal</span>
                <span className="font-display text-lg font-bold">{formatBRL(subtotal)}</span>
              </div>
              <button
                onClick={() => { close(); navigate({ to: "/checkout" }); }}
                className="w-full rounded-md bg-neon py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-transform hover:scale-[1.01] active:scale-[0.99] glow"
              >
                Finalizar compra
              </button>
              <button onClick={close} className="mt-2 w-full text-center text-xs text-muted-foreground hover:text-foreground">
                Continuar comprando
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

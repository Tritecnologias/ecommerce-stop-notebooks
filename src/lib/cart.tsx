import { createContext, useContext, useEffect, useRef, useMemo, useState, type ReactNode } from "react";
import { PRODUCTS, type Product } from "./products";
import { supabase } from "./supabase";
import { loadServerCart, syncServerCart } from "@/fns/server-cart";

export type CartItem = {
  slug: string;
  size: string;
  quantity: number;
};

type CartCtx = {
  items: CartItem[];
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  add: (slug: string, size: string, quantity?: number) => void;
  remove: (slug: string, size: string) => void;
  setQty: (slug: string, size: string, q: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
  detailed: { item: CartItem; product: Product; lineTotal: number }[];
  productsCache: Record<string, Product>;
  setProductsCache: (products: Product[]) => void;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "bs_cart_v2";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [productsCache, setProductsCacheState] = useState<Record<string, Product>>(
    Object.fromEntries(PRODUCTS.map((p) => [p.slug, p])),
  );
  const userIdRef = useRef<string | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Hidratação local ──────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(KEY, JSON.stringify(items));
  }, [items, hydrated]);

  // ── Sincronização com servidor ────────────────────────────────────────────
  useEffect(() => {
    if (!hydrated) return;

    // Listener de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const userId = session?.user?.id ?? null;
      const prevId = userIdRef.current;
      userIdRef.current = userId;

      if (userId && (event === "SIGNED_IN" || (event === "INITIAL_SESSION" && userId !== prevId))) {
        try {
          const serverItems = await loadServerCart({ data: userId });
          if (serverItems.length > 0) {
            // Merge: combina local + servidor, tomando max quantity
            setItems((localItems) => {
              const merged = [...localItems];
              for (const si of serverItems) {
                const idx = merged.findIndex((i) => i.slug === si.slug && i.size === si.size);
                if (idx >= 0) {
                  merged[idx] = { ...merged[idx], quantity: Math.max(merged[idx].quantity, si.quantity) };
                } else {
                  merged.push(si);
                }
              }
              return merged;
            });
          }
        } catch {
          // Silencia erros (migration pode não ter sido executada ainda)
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [hydrated]);

  // Debounce sync: envia o carrinho ao servidor 3s após última mudança
  useEffect(() => {
    if (!hydrated) return;
    if (!userIdRef.current) return;
    const userId = userIdRef.current;

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      syncServerCart({ data: { userId, items } }).catch(() => {});
    }, 3000);

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [items, hydrated]);

  function setProductsCache(products: Product[]) {
    setProductsCacheState(Object.fromEntries(products.map((p) => [p.slug, p])));
  }

  const value = useMemo<CartCtx>(() => {
    const detailed = items
      .map((item) => {
        const product = productsCache[item.slug];
        if (!product) return null;
        return { item, product, lineTotal: product.price * item.quantity };
      })
      .filter(Boolean) as CartCtx["detailed"];

    return {
      items,
      isOpen,
      open: () => setOpen(true),
      close: () => setOpen(false),
      toggle: () => setOpen((v) => !v),
      add: (slug, size, quantity = 1) => {
        setItems((prev) => {
          const idx = prev.findIndex((i) => i.slug === slug && i.size === size);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], quantity: next[idx].quantity + quantity };
            return next;
          }
          return [...prev, { slug, size, quantity }];
        });
        setOpen(true);
      },
      remove: (slug, size) =>
        setItems((prev) => prev.filter((i) => !(i.slug === slug && i.size === size))),
      setQty: (slug, size, q) =>
        setItems((prev) =>
          prev
            .map((i) => (i.slug === slug && i.size === size ? { ...i, quantity: Math.max(1, q) } : i))
            .filter((i) => i.quantity > 0),
        ),
      clear: () => setItems([]),
      count: items.reduce((a, i) => a + i.quantity, 0),
      subtotal: detailed.reduce((a, d) => a + d.lineTotal, 0),
      detailed,
      productsCache,
      setProductsCache,
    };
  }, [items, isOpen, productsCache]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useCart = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCart must be inside CartProvider");
  return v;
};

export const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { PRODUCTS, type Product } from "./products";

export type CartItem = {
  productId: string;
  size: string;
  quantity: number;
};

type CartCtx = {
  items: CartItem[];
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  add: (productId: string, size: string, quantity?: number) => void;
  remove: (productId: string, size: string) => void;
  setQty: (productId: string, size: string, q: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
  detailed: { item: CartItem; product: Product; lineTotal: number }[];
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "bs_cart_v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

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

  const value = useMemo<CartCtx>(() => {
    const detailed = items
      .map((item) => {
        const product = PRODUCTS.find((p) => p.id === item.productId);
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
      add: (productId, size, quantity = 1) => {
        setItems((prev) => {
          const idx = prev.findIndex((i) => i.productId === productId && i.size === size);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], quantity: next[idx].quantity + quantity };
            return next;
          }
          return [...prev, { productId, size, quantity }];
        });
        setOpen(true);
      },
      remove: (productId, size) =>
        setItems((prev) => prev.filter((i) => !(i.productId === productId && i.size === size))),
      setQty: (productId, size, q) =>
        setItems((prev) =>
          prev
            .map((i) =>
              i.productId === productId && i.size === size ? { ...i, quantity: Math.max(1, q) } : i,
            )
            .filter((i) => i.quantity > 0),
        ),
      clear: () => setItems([]),
      count: items.reduce((a, i) => a + i.quantity, 0),
      subtotal: detailed.reduce((a, d) => a + d.lineTotal, 0),
      detailed,
    };
  }, [items, isOpen]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useCart = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCart must be inside CartProvider");
  return v;
};

export const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

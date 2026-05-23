import { Link } from "@tanstack/react-router";
import { ShoppingBag, Search } from "lucide-react";
import { useCart } from "@/lib/cart";
import { STORE } from "@/lib/store";

export function Header() {
  const { count, toggle } = useCart();
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 md:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-neon glow animate-pulse-glow" />
          <span className="font-display text-lg font-bold tracking-tight">
            {STORE.name.toUpperCase()}
          </span>
        </Link>

        <nav className="ml-6 hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <Link to="/" className="hover:text-foreground transition-colors">Coleção</Link>
          <a href="/#bestsellers" className="hover:text-foreground transition-colors">Mais vendidos</a>
          <a href="/#novidades" className="hover:text-foreground transition-colors">Novidades</a>
        </nav>

        <div className="ml-auto flex flex-1 items-center justify-end gap-2 md:flex-none md:w-80">
          <div className="relative hidden md:block w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Buscar fragrância…"
              className="h-10 w-full rounded-md border border-border bg-secondary/50 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-neon focus:outline-none focus:ring-1 focus:ring-neon transition"
            />
          </div>

          <button
            onClick={toggle}
            aria-label="Abrir carrinho"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-border hover:border-neon hover:text-neon transition-colors"
          >
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-neon px-1 text-[11px] font-bold text-primary-foreground glow">
                {count}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

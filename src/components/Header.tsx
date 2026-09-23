import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag, Search, User, LogOut, Package, LayoutDashboard } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { STORE } from "@/lib/store";
import { getActiveLogos } from "@/fns/logos";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { SearchOverlay } from "@/components/SearchOverlay";

export function Header() {
  const { count, toggle } = useCart();
  const { user, profile, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { data: activeLogos } = useQuery({
    queryKey: ["active-logos"],
    queryFn: () => getActiveLogos(),
    staleTime: 60 * 1000,
  });
  const headerLogo = activeLogos?.header;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = async () => {
    await logout();
    setMenuOpen(false);
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-4 px-4 py-2 md:px-6">
        <Link to="/" className="flex items-center gap-2">
          {headerLogo ? (
            <img
              src={headerLogo.url}
              alt={headerLogo.alt_text || STORE.name}
              style={{ maxHeight: `${headerLogo.height || 48}px` }}
              className="object-contain w-auto transition-all"
            />
          ) : (
            <>
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-neon glow animate-pulse-glow" />
              <span className="font-display text-lg font-bold tracking-tight">
                {STORE.name.toUpperCase()}
              </span>
            </>
          )}
        </Link>

        <nav className="ml-6 hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <Link to="/" className="hover:text-foreground transition-colors">Produtos</Link>
          <a href="/#bestsellers" className="hover:text-foreground transition-colors">Mais vendidos</a>
          <Link to="/monte-seu-kit" className="hover:text-foreground transition-colors">Monte seu Kit</Link>
          <a href="/#novidades" className="hover:text-foreground transition-colors">Novidades</a>
        </nav>

        <div className="ml-auto flex flex-1 items-center justify-end gap-2 md:flex-none md:w-80">
          {/* Desktop search input — opens overlay on focus/click */}
          <div className="relative hidden md:block w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              placeholder="Buscar produto…"
              value={searchQuery}
              readOnly
              onClick={() => setSearchOpen(true)}
              onFocus={() => setSearchOpen(true)}
              className="h-10 w-full cursor-pointer rounded-md border border-border bg-secondary/50 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-neon focus:outline-none focus:ring-1 focus:ring-neon transition"
            />
          </div>

          {/* Mobile search button */}
          <button
            onClick={() => setSearchOpen(true)}
            aria-label="Buscar"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border hover:border-neon hover:text-neon transition-colors md:hidden"
          >
            <Search className="h-5 w-5" />
          </button>

          {/* User menu */}
          <div className="relative" ref={menuRef}>
            {user ? (
              <>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label="Menu do usuário"
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-border hover:border-neon hover:text-neon transition-colors"
                >
                  <User className="h-5 w-5" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-12 w-52 rounded-lg border border-border bg-card shadow-lg py-1 z-50">
                    <div className="border-b border-border px-4 py-2.5">
                      <p className="text-xs font-semibold truncate">{profile?.name ?? user.email}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <MenuItem to="/conta" icon={User} label="Minha conta" onClick={() => setMenuOpen(false)} />
                    <MenuItem to="/conta/pedidos" icon={Package} label="Meus pedidos" onClick={() => setMenuOpen(false)} />
                    {profile?.role === "admin" && (
                      <MenuItem to="/admin" icon={LayoutDashboard} label="Painel admin" onClick={() => setMenuOpen(false)} />
                    )}
                    <div className="border-t border-border mt-1 pt-1">
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-muted-foreground hover:text-destructive hover:bg-secondary/50 transition-colors"
                      >
                        <LogOut className="h-4 w-4" /> Sair
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <Link
                to="/login"
                className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm hover:border-neon hover:text-neon transition-colors"
              >
                <User className="h-4 w-4" /> Entrar
              </Link>
            )}
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
      <SearchOverlay
        open={searchOpen}
        onClose={() => {
          setSearchOpen(false);
          setSearchQuery("");
        }}
        initialQuery={searchQuery}
      />
    </header>
  );
}

function MenuItem({
  to,
  icon: Icon,
  label,
  onClick,
}: {
  to: string;
  icon: typeof User;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-2.5 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

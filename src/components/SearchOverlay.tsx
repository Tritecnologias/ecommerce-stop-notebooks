import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Search, X, ArrowRight, Package } from "lucide-react";
import { getProducts } from "@/fns/products";
import { dbProductToProduct } from "@/lib/products";
import { formatBRL } from "@/lib/cart";

type Product = ReturnType<typeof dbProductToProduct>;

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-neon/30 text-neon rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function scoreProduct(p: Product, q: string): number {
  const ql = q.toLowerCase();
  if (p.name.toLowerCase().startsWith(ql)) return 3;
  if (p.name.toLowerCase().includes(ql)) return 2;
  if (p.category?.toLowerCase().includes(ql)) return 1;
  if (p.description?.toLowerCase().includes(ql)) return 0.5;
  if (p.notes?.some((n) => n.toLowerCase().includes(ql))) return 0.5;
  return -1;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initialQuery?: string;
}

export function SearchOverlay({ open, onClose, initialQuery = "" }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const { data: dbProducts } = useQuery({
    queryKey: ["products"],
    queryFn: () => getProducts(),
    staleTime: 5 * 60 * 1000,
  });

  const products = (dbProducts ?? []).map(dbProductToProduct);

  const results: Product[] = query.trim().length < 2
    ? []
    : products
        .map((p) => ({ p, score: scoreProduct(p, query.trim()) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map(({ p }) => p);

  // Focar input quando abrir
  useEffect(() => {
    if (open) {
      setQuery(initialQuery);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, initialQuery]);

  // Fechar com Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Bloquear scroll do body
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  const goToProduct = (slug: string) => {
    navigate({ to: "/produto/$slug", params: { slug } });
    onClose();
  };

  const goToAll = () => {
    navigate({
      to: "/busca",
      search: { q: query.trim(), categoria: "", tag: "", ordenar: "relevancia", minPreco: undefined, maxPreco: undefined },
    });
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && query.trim().length >= 2) {
      goToAll();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Painel */}
      <div className="fixed left-1/2 top-[10%] z-50 w-full max-w-xl -translate-x-1/2 px-4">
        <div className="rounded-xl border border-border bg-card shadow-2xl overflow-hidden">

          {/* Input */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Search className="h-5 w-5 flex-none text-neon" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar produto, categoria, marca…"
              className="flex-1 bg-transparent text-base placeholder:text-muted-foreground focus:outline-none"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
            <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground ml-1">
              Esc
            </button>
          </div>

          {/* Resultados */}
          <div className="max-h-[60vh] overflow-y-auto">
            {query.trim().length < 2 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                Digite pelo menos 2 caracteres para buscar
              </div>
            ) : results.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <Package className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Nenhum produto encontrado para <strong className="text-foreground">"{query}"</strong>
                </p>
              </div>
            ) : (
              <>
                <ul className="divide-y divide-border">
                  {results.map((product) => (
                    <li key={product.id}>
                      <button
                        onClick={() => goToProduct(product.slug)}
                        className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-secondary/40 transition-colors"
                      >
                        {/* Imagem */}
                        <div className="h-12 w-12 flex-none rounded-lg border border-border bg-secondary overflow-hidden">
                          {product.images?.[0] ? (
                            <img
                              src={product.images[0]}
                              alt={product.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <Package className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">
                            {highlight(product.name, query)}
                          </p>
                          {product.category && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {highlight(product.category, query)}
                            </p>
                          )}
                          {product.notes && product.notes.length > 0 && (
                            <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5">
                              {product.notes.join(" · ")}
                            </p>
                          )}
                        </div>

                        {/* Preço */}
                        <div className="flex-none text-right">
                          <p className="text-sm font-bold text-neon">{formatBRL(product.price)}</p>
                          {product.oldPrice && (
                            <p className="text-xs text-muted-foreground line-through">
                              {formatBRL(product.oldPrice)}
                            </p>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>

                {/* Ver todos */}
                <div className="border-t border-border px-4 py-3">
                  <button
                    onClick={goToAll}
                    className="flex w-full items-center justify-between text-sm text-neon hover:underline"
                  >
                    <span>Ver todos os resultados para "{query}"</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}
          </div>

        </div>
      </div>
    </>
  );
}

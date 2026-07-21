/**
 * Componente reutilizável de histórico de estoque.
 * Prefixado com `-` para não ser tratado como rota pelo TanStack Router.
 *
 * Uso:
 *  - Sem props → exibe as 20 movimentações mais recentes de todos os produtos
 *  - productId  → filtra pelo produto específico (até 30 entradas)
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { getStockLogs } from "@/fns/products";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: d > 365 ? "numeric" : undefined,
  });
}

const sourceLabel: Record<string, string> = {
  manual: "Admin",
  form: "Formulário",
  order: "Pedido",
  import: "Importação",
};

function DeltaBadge({ before, after }: { before: number; after: number }) {
  const delta = after - before;
  if (delta === 0) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
        delta > 0
          ? "bg-green-500/15 text-green-400"
          : "bg-destructive/15 text-destructive"
      }`}
    >
      {delta > 0 ? "+" : ""}
      {delta}
    </span>
  );
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function StockMovements({
  productId,
  productName,
}: {
  productId?: string;
  productName?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ["stock-logs", productId ?? "global"],
    queryFn: () => getStockLogs({ data: { productId, limit: productId ? 30 : 20 } }),
    enabled: expanded,
    staleTime: 30 * 1000,
  });

  const title = productId
    ? `Histórico de estoque${productName ? ` — ${productName}` : ""}`
    : "Movimentações recentes";

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* ── Cabeçalho clicável ─────────────────────────────────────────────── */}
      <button
        onClick={() => {
          setExpanded((v) => !v);
          if (!expanded) refetch();
        }}
        className="flex w-full items-center justify-between px-5 py-3.5 text-sm font-semibold hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <span>{title}</span>
          {!isLoading && expanded && logs.length > 0 && (
            <span className="ml-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-muted-foreground">
              {logs.length}
            </span>
          )}
        </div>
        <span className="text-muted-foreground text-xs">
          {expanded ? "▲ recolher" : "▼ expandir"}
        </span>
      </button>

      {/* ── Conteúdo ──────────────────────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-border">
          {isLoading ? (
            <div className="px-5 py-6 text-center text-sm text-muted-foreground">
              Carregando…
            </div>
          ) : logs.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <History className="mx-auto mb-3 h-9 w-9 text-muted-foreground/20" />
              <p className="text-sm font-semibold text-muted-foreground">
                Nenhuma movimentação registrada
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Toda alteração de estoque feita a partir de agora aparecerá aqui.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/20 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5 whitespace-nowrap">Quando</th>
                    {!productId && (
                      <th className="px-4 py-2.5 whitespace-nowrap">Produto</th>
                    )}
                    <th className="px-4 py-2.5 text-right whitespace-nowrap">Antes</th>
                    <th className="px-4 py-2.5 text-right whitespace-nowrap">Depois</th>
                    <th className="px-4 py-2.5 whitespace-nowrap">Δ</th>
                    <th className="px-4 py-2.5 whitespace-nowrap">Por</th>
                    <th className="px-4 py-2.5 whitespace-nowrap">Origem</th>
                    <th className="px-4 py-2.5 whitespace-nowrap">Nota</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-secondary/10 transition-colors"
                    >
                      {/* Quando */}
                      <td className="px-4 py-2.5">
                        <time
                          dateTime={log.created_at}
                          title={new Date(log.created_at).toLocaleString("pt-BR")}
                          className="text-xs text-muted-foreground whitespace-nowrap"
                        >
                          {relTime(log.created_at)}
                        </time>
                      </td>

                      {/* Produto — só na visão global */}
                      {!productId && (
                        <td className="px-4 py-2.5">
                          <span className="block max-w-[140px] truncate text-xs font-medium">
                            {log.product_name}
                          </span>
                        </td>
                      )}

                      {/* Antes */}
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-muted-foreground">
                        {log.qty_before}
                      </td>

                      {/* Depois */}
                      <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold">
                        {log.qty_after}
                      </td>

                      {/* Delta */}
                      <td className="px-4 py-2.5">
                        <DeltaBadge before={log.qty_before} after={log.qty_after} />
                      </td>

                      {/* Por */}
                      <td className="px-4 py-2.5">
                        <span className="block max-w-[120px] truncate text-xs text-muted-foreground">
                          {log.admin_name ?? (
                            <span className="italic opacity-40">sistema</span>
                          )}
                        </span>
                      </td>

                      {/* Origem */}
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            log.source === "manual"
                              ? "bg-neon/10 text-neon"
                              : log.source === "order"
                              ? "bg-blue-500/10 text-blue-400"
                              : log.source === "form"
                              ? "bg-orange-500/10 text-orange-400"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {sourceLabel[log.source] ?? log.source}
                        </span>
                      </td>

                      {/* Nota */}
                      <td className="px-4 py-2.5">
                        <span className="text-xs text-muted-foreground/70">
                          {log.note ?? "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

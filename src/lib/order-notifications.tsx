import { createContext, useContext, useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { toast } from "sonner";
import { getAdminOrders } from "@/fns/orders";
import { formatBRL } from "./cart";
import { useAuth } from "./auth";

type NotifCtx = { newCount: number; markSeen: () => void };
const Ctx = createContext<NotifCtx>({ newCount: 0, markSeen: () => {} });

const POLL_INTERVAL = 30_000; // 30s

export function OrderNotifProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [newCount, setNewCount] = useState(0);
  const lastTotalRef = useRef<number | null>(null);
  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;

    const check = async () => {
      try {
        const result = await getAdminOrders({ data: { page: 1, limit: 5 } });
        if (cancelled) return;

        const currentTotal = result.total;

        // Primeira execução: só registra a baseline, sem notificar
        if (lastTotalRef.current === null) {
          lastTotalRef.current = currentTotal;
          return;
        }

        if (currentTotal > lastTotalRef.current) {
          const diff = currentTotal - lastTotalRef.current;
          lastTotalRef.current = currentTotal;
          setNewCount((c) => c + diff);

          // Mostra toast para cada pedido novo (até 5)
          for (const order of result.orders.slice(0, diff)) {
            toast.success(`Novo pedido #${order.order_number}`, {
              description: `${order.customer_name} — ${formatBRL(order.total)}`,
              duration: 10_000,
              action: { label: "Ver", onClick: () => { window.location.href = `/admin/pedidos/${order.id}`; } },
            });
          }
        }
      } catch {
        // falha silenciosa — não bloqueia o admin
      }
    };

    check();
    const id = setInterval(check, POLL_INTERVAL);
    return () => { cancelled = true; clearInterval(id); };
  }, [isAdmin]);

  const markSeen = useCallback(() => setNewCount(0), []);

  return <Ctx.Provider value={{ newCount, markSeen }}>{children}</Ctx.Provider>;
}

export const useOrderNotif = () => useContext(Ctx);

import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Mail, Package } from "lucide-react";

type Search = { id?: string };

export const Route = createFileRoute("/sucesso")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    id: typeof s.id === "string" ? s.id : undefined,
  }),
  head: () => ({ meta: [{ title: "Pedido confirmado — BodySplashers" }] }),
  component: Success,
});

function Success() {
  const { id } = Route.useSearch();
  const orderId = id ?? Math.random().toString(36).slice(2, 10).toUpperCase();

  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-neon glow-strong animate-check-pop">
        <Check className="h-10 w-10 text-primary-foreground" strokeWidth={3} />
      </div>

      <h1 className="mt-8 font-display text-3xl font-bold md:text-4xl">Pedido confirmado!</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Obrigado pela compra. Enviamos um e-mail com a confirmação e os detalhes.
      </p>

      <div className="mt-8 rounded-lg border border-border bg-card p-6 text-left">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Número do pedido</span>
          <span className="font-display text-lg font-bold text-neon">#{orderId}</span>
        </div>

        <div className="mt-6 space-y-4 border-t border-border pt-6 text-sm">
          <div className="flex gap-3">
            <Mail className="h-5 w-5 flex-none text-neon" />
            <div>
              <p className="font-semibold">Confirmação enviada</p>
              <p className="text-xs text-muted-foreground">Verifique sua caixa de entrada nos próximos minutos.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Package className="h-5 w-5 flex-none text-neon" />
            <div>
              <p className="font-semibold">Rastreio em até 2 dias úteis</p>
              <p className="text-xs text-muted-foreground">Enviaremos o código de rastreio assim que seu pedido for despachado.</p>
            </div>
          </div>
        </div>
      </div>

      <Link
        to="/"
        className="mt-8 inline-block rounded-md bg-neon px-8 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground glow transition-transform hover:scale-[1.02]"
      >
        Continuar comprando
      </Link>
    </div>
  );
}

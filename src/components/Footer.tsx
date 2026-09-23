import { ShieldCheck, Truck, CreditCard, Lock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { STORE } from "@/lib/store";
import { getActiveLogos } from "@/fns/logos";

export function Footer() {
  const { data: activeLogos } = useQuery({
    queryKey: ["active-logos"],
    queryFn: () => getActiveLogos(),
    staleTime: 60 * 1000,
  });
  const footerLogo = activeLogos?.footer || activeLogos?.header;

  return (
    <footer className="mt-24 border-t border-border bg-card/40">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              {footerLogo ? (
                <img
                  src={footerLogo.url}
                  alt={footerLogo.alt_text || STORE.name}
                  style={{ maxHeight: `${footerLogo.height || 48}px` }}
                  className="object-contain w-auto"
                />
              ) : (
                <>
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-neon glow" />
                  <span className="font-display text-lg font-bold">{STORE.name.toUpperCase()}</span>
                </>
              )}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{STORE.tagline}</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Loja</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-neon">Vibradores</a></li>
              <li><a href="#" className="hover:text-neon">Lingeries</a></li>
              <li><a href="#" className="hover:text-neon">Cosméticos</a></li>
              <li><a href="#" className="hover:text-neon">Mais vendidos</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Ajuda</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><a href="/faq" className="hover:text-neon">Perguntas frequentes</a></li>
              <li><a href="/faq" className="hover:text-neon">Entrega discreta</a></li>
              <li><a href="#" className="hover:text-neon">Trocas e devoluções</a></li>
              <li><a href="/privacidade" className="hover:text-neon">Política de privacidade</a></li>
              <li><a href="#" className="hover:text-neon">Contato</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Pagamento</h4>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {["PIX", "VISA", "MASTER", "ELO", "BOLETO"].map((p) => (
                <span key={p} className="rounded border border-border px-2 py-1 text-muted-foreground">{p}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-neon" /> Embalagem discreta</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-neon" /> Sigilo no cartão</span>
            <span className="inline-flex items-center gap-1.5"><Truck className="h-3.5 w-3.5 text-neon" /> Envio em 24h</span>
            <span className="inline-flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5 text-neon" /> Parcelado em até 6x</span>
          </div>
          <p>© {new Date().getFullYear()} {STORE.name}. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}

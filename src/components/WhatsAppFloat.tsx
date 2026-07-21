/**
 * Botão flutuante de suporte via WhatsApp.
 * Só exibe quando `supportPhone` estiver configurado nas settings.
 * Oculto em rotas /admin/*.
 */
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { getWhatsAppSettings } from "@/fns/whatsapp";

// SVG inline do ícone oficial do WhatsApp
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export function WhatsAppFloat() {
  const location = useRouterState({ select: (s) => s.location.pathname });

  // Não renderiza na área admin
  if (location.startsWith("/admin")) return null;

  return <FloatButton />;
}

function FloatButton() {
  const { data: settings } = useQuery({
    queryKey: ["whatsapp-settings-public"],
    queryFn: () => getWhatsAppSettings(),
    staleTime: 10 * 60 * 1000,
  });

  const phone = settings?.supportPhone?.replace(/\D/g, "");
  if (!settings?.enabled || !phone) return null;

  const href = `https://wa.me/${phone.startsWith("55") ? phone : `55${phone}`}?text=Olá!%20Vim%20pelo%20site%20e%20preciso%20de%20ajuda%20😊`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Fale conosco pelo WhatsApp"
      className="group fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-[#25D366]/30 transition-all duration-200 hover:scale-110 hover:shadow-[#25D366]/50 hover:shadow-xl"
    >
      <WhatsAppIcon className="h-7 w-7" />

      {/* Tooltip */}
      <span className="pointer-events-none absolute right-16 whitespace-nowrap rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
        Fale conosco
        {/* seta */}
        <span className="absolute right-[-5px] top-1/2 -translate-y-1/2 border-4 border-transparent border-l-card" />
      </span>

      {/* Pulso vivo */}
      <span className="absolute inset-0 rounded-full animate-ping bg-[#25D366]/40 [animation-duration:2s]" />
    </a>
  );
}

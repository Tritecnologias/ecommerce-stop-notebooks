import { useState, useEffect, useCallback } from "react";

/**
 * Boss Mode — ao pressionar ESC duas vezes rapidamente ou clicar no botão,
 * substitui toda a tela por uma página neutra (Google-like).
 * Pressionar ESC novamente ou clicar "Voltar" restaura a loja.
 */
export function BossMode() {
  const [active, setActive] = useState(false);
  const [lastEsc, setLastEsc] = useState(0);

  const activate = useCallback(() => {
    setActive(true);
    document.title = "Google";
  }, []);

  const deactivate = useCallback(() => {
    setActive(false);
    document.title = "Secret Desire — Prazer com discrição";
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (active) {
          deactivate();
          return;
        }
        const now = Date.now();
        if (now - lastEsc < 500) {
          activate();
        }
        setLastEsc(now);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [active, lastEsc, activate, deactivate]);

  if (!active) {
    return (
      <button
        onClick={activate}
        title="Modo discreto (ESC + ESC)"
        className="fixed bottom-20 left-4 z-50 flex h-8 w-8 items-center justify-center rounded-full bg-secondary/80 border border-border text-muted-foreground opacity-30 hover:opacity-100 transition-opacity text-xs font-bold"
      >
        🔒
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-white">
      {/* Fake Google-like page */}
      <div className="flex flex-col items-center gap-6 w-full max-w-lg px-4">
        <div className="text-7xl font-normal" style={{ fontFamily: "Product Sans, Arial, sans-serif" }}>
          <span style={{ color: "#4285f4" }}>G</span>
          <span style={{ color: "#ea4335" }}>o</span>
          <span style={{ color: "#fbbc05" }}>o</span>
          <span style={{ color: "#4285f4" }}>g</span>
          <span style={{ color: "#34a853" }}>l</span>
          <span style={{ color: "#ea4335" }}>e</span>
        </div>
        <div className="w-full max-w-md">
          <div className="flex items-center rounded-full border border-gray-200 px-5 py-3 shadow-sm hover:shadow-md transition-shadow">
            <svg className="h-5 w-5 text-gray-400 mr-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <span className="text-gray-400 text-sm">Pesquisar no Google ou digitar um URL</span>
          </div>
        </div>
        <div className="flex gap-3 mt-2">
          <button className="rounded bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:border hover:border-gray-300">
            Pesquisa Google
          </button>
          <button className="rounded bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:border hover:border-gray-300">
            Estou com sorte
          </button>
        </div>
      </div>

      {/* Botão discreto para voltar */}
      <button
        onClick={deactivate}
        className="fixed bottom-4 right-4 text-[10px] text-gray-300 hover:text-gray-500 transition-colors"
      >
        Pressione ESC para voltar
      </button>
    </div>
  );
}

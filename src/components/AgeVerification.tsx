import { useState, useEffect } from "react";
import { ShieldCheck } from "lucide-react";
import { STORE } from "@/lib/store";

const STORAGE_KEY = "age_verified";

export function AgeVerification() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const verified = localStorage.getItem(STORAGE_KEY);
    if (!verified) {
      setShow(true);
      document.body.style.overflow = "hidden";
    }
  }, []);

  function handleConfirm() {
    localStorage.setItem(STORAGE_KEY, "true");
    setShow(false);
    document.body.style.overflow = "";
  }

  function handleDeny() {
    window.location.href = "https://www.google.com";
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-md">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Logo */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-neon/10 border border-neon/30">
          <ShieldCheck className="h-7 w-7 text-neon" />
        </div>

        {/* Título */}
        <h2 className="font-display text-2xl font-bold">{STORE.name}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Este site contém conteúdo destinado exclusivamente para maiores de 18 anos.
        </p>

        {/* Aviso */}
        <div className="mt-6 rounded-lg bg-secondary/50 border border-border p-4">
          <p className="text-sm font-medium">
            Você confirma que tem 18 anos ou mais?
          </p>
        </div>

        {/* Botões */}
        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={handleConfirm}
            className="w-full rounded-lg bg-neon py-3 text-sm font-bold text-primary-foreground glow transition-opacity hover:opacity-90 active:scale-[0.98]"
          >
            Sim, tenho 18 anos ou mais
          </button>
          <button
            onClick={handleDeny}
            className="w-full rounded-lg border border-border py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
          >
            Não, sou menor de idade
          </button>
        </div>

        {/* Disclaimer */}
        <p className="mt-5 text-[11px] text-muted-foreground/70">
          Ao confirmar, você declara estar ciente de que este site comercializa produtos eróticos e adultos.
          Sua privacidade é respeitada — não armazenamos dados pessoais nesta verificação.
        </p>
      </div>
    </div>
  );
}

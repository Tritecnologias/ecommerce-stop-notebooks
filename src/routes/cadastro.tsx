import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const schema = z.object({
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Senhas não coincidem",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof schema>;

export const Route = createFileRoute("/cadastro")({
  head: () => ({ meta: [{ title: "Criar conta — Secret Desire" }] }),
  component: Register,
});

function Register() {
  const { register: registerAuth } = useAuth();
  const navigate = useNavigate();
  const [showPwd, setShowPwd] = useState(false);
  const [serverError, setServerError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  const loginWithGoogle = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/conta` },
    });
    if (error) { setServerError(error.message); setGoogleLoading(false); }
  };
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormData) => {
    setServerError("");
    const { error } = await registerAuth(values.name, values.email, values.password);
    if (error) {
      setServerError(error.includes("already") ? "Este e-mail já está cadastrado" : error);
      return;
    }
    setSuccess(true);
    setTimeout(() => navigate({ to: "/conta" }), 2000);
  };

  if (success) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-neon glow mb-4">
            <span className="text-2xl text-primary-foreground">✓</span>
          </div>
          <h2 className="font-display text-2xl font-bold">Conta criada!</h2>
          <p className="mt-2 text-sm text-muted-foreground">Redirecionando para sua conta…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="inline-block h-3 w-3 rounded-full bg-neon glow animate-pulse-glow mb-4" />
          <h1 className="font-display text-3xl font-bold">Criar conta</h1>
          <p className="mt-2 text-sm text-muted-foreground">Rápido, fácil e gratuito</p>
        </div>

        {/* Google OAuth */}
        <button
          type="button"
          onClick={loginWithGoogle}
          disabled={googleLoading}
          className="mb-6 flex w-full items-center justify-center gap-3 rounded-md border border-border bg-secondary/30 py-2.5 text-sm font-semibold transition-colors hover:border-foreground/40 hover:bg-secondary/60 disabled:opacity-60"
        >
          {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          {googleLoading ? "Redirecionando…" : "Cadastrar com Google"}
        </button>

        <div className="relative mb-6 flex items-center gap-3">
          <div className="flex-1 border-t border-border" />
          <span className="text-xs text-muted-foreground">ou crie sua conta</span>
          <div className="flex-1 border-t border-border" />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <Field label="Nome completo" error={errors.name?.message}>
            <input {...register("name")} placeholder="Seu nome" className={inputCls} />
          </Field>

          <Field label="E-mail" error={errors.email?.message}>
            <input {...register("email")} type="email" placeholder="seu@email.com" className={inputCls} />
          </Field>

          <Field label="Senha" error={errors.password?.message}>
            <div className="relative">
              <input
                {...register("password")}
                type={showPwd ? "text" : "password"}
                placeholder="Mínimo 6 caracteres"
                className={inputCls + " pr-10"}
              />
              <button type="button" onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          <Field label="Confirmar senha" error={errors.confirmPassword?.message}>
            <input
              {...register("confirmPassword")}
              type={showPwd ? "text" : "password"}
              placeholder="Repita sua senha"
              className={inputCls}
            />
          </Field>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md bg-neon py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-transform hover:scale-[1.01] disabled:opacity-70 glow"
          >
            {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Criando…</> : "Criar conta"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/login" className="text-neon hover:underline font-semibold">Entrar</Link>
        </p>
      </div>
    </div>
  );
}

const inputCls =
  "h-11 w-full rounded-md border border-border bg-secondary/50 px-3 text-sm placeholder:text-muted-foreground focus:border-neon focus:outline-none focus:ring-1 focus:ring-neon transition";

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

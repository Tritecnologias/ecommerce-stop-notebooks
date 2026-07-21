import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Profile } from "./types";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  register: (name: string, email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    setProfile(data ?? null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id);
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function login(email: string, password: string) {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await res.json();
      if (result.error) return { error: result.error };
      if (result.session) {
        // Store session directly in localStorage (avoid CORS call to Supabase)
        const storageKey = `sb-${new URL(import.meta.env.VITE_SUPABASE_URL || "http://localhost").hostname.split(".")[0]}-auth-token`;
        localStorage.setItem(storageKey, JSON.stringify(result.session));
        // Update local state
        setSession(result.session);
        setUser(result.session.user);
        if (result.session.user) await loadProfile(result.session.user.id);
      }
      return { error: null };
    } catch (e) {
      return { error: "Erro de conexão" };
    }
  }

  async function register(name: string, email: string, password: string) {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const result = await res.json();
      if (result.error) return { error: result.error };
      if (result.session) {
        const storageKey = `sb-${new URL(import.meta.env.VITE_SUPABASE_URL || "http://localhost").hostname.split(".")[0]}-auth-token`;
        localStorage.setItem(storageKey, JSON.stringify(result.session));
        setSession(result.session);
        setUser(result.session.user);
        if (result.session.user) await loadProfile(result.session.user.id);
      }
      return { error: null };
    } catch (e) {
      return { error: "Erro de conexão" };
    }
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  async function refreshProfile() {
    if (user) await loadProfile(user.id);
  }

  return (
    <Ctx.Provider value={{ user, session, profile, loading, login, register, logout, refreshProfile }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
}

export function useRequireAuth(redirectTo = "/login") {
  const auth = useAuth();
  return auth;
}

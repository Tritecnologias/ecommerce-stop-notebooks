import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

// Client with anon key for auth operations (service_role doesn't support signIn)
function createSupabaseAuth() {
  const url = process.env.SUPABASE_URL || "";
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const serverLogin = createServerFn()
  .inputValidator((input: unknown) =>
    z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const db = createSupabaseAuth();
    const { data: authData, error } = await db.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (error) return { error: error.message, session: null };
    return { error: null, session: authData.session };
  });

export const serverRegister = createServerFn()
  .inputValidator((input: unknown) =>
    z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(6),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const db = createSupabaseAuth();
    const { data: authData, error } = await db.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { name: data.name } },
    });
    if (error) return { error: error.message, session: null };
    return { error: null, session: authData.session };
  });

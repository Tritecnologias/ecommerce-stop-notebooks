import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase";

export const serverLogin = createServerFn()
  .inputValidator((input: unknown) =>
    z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const db = createSupabaseAdmin();
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
    const db = createSupabaseAdmin();
    const { data: authData, error } = await db.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { name: data.name } },
    });
    if (error) return { error: error.message, session: null };
    return { error: null, session: authData.session };
  });

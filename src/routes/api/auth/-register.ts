import { createAPIFileRoute } from "@tanstack/react-start/api";
import { createClient } from "@supabase/supabase-js";

export const APIRoute = createAPIFileRoute("/api/auth/register")({
  POST: async ({ request }) => {
    try {
      const body = await request.json();
      const { name, email, password } = body;

      if (!email || !password || !name) {
        return new Response(JSON.stringify({ error: "Nome, email e senha são obrigatórios" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const url = process.env.SUPABASE_URL || "";
      const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

      const supabase = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });

      if (error) {
        return new Response(JSON.stringify({ error: error.message, session: null }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: null, session: data.session }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: "Erro interno", session: null }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
});

import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { createClient } from "@supabase/supabase-js";

function devApiAuthPlugin(env: Record<string, string>): Plugin {
  return {
    name: "dev-api-auth-plugin",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/auth/")) {
          return next();
        }

        try {
          const url = new URL(req.url, "http://localhost");
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
          }
          const body = chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString()) : {};

          const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
          const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

          const supabase = createClient(supabaseUrl, anonKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          });

          let result: { error: string | null; session: any };
          if (url.pathname === "/api/auth/login") {
            const { data, error } = await supabase.auth.signInWithPassword({
              email: body.email,
              password: body.password,
            });
            result = error ? { error: error.message, session: null } : { error: null, session: data.session };
          } else if (url.pathname === "/api/auth/register") {
            const { data, error } = await supabase.auth.signUp({
              email: body.email,
              password: body.password,
              options: { data: { name: body.name } },
            });
            result = error ? { error: error.message, session: null } : { error: null, session: data.session };
          } else {
            res.statusCode = 404;
            res.end("Not Found");
            return;
          }

          res.statusCode = result.error ? 401 : 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result));
        } catch (e) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Erro interno", session: null }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tailwindcss(),
      tanstackStart(),
      react(),
      devApiAuthPlugin(env),
    ],
    resolve: {
      alias: {
        "@": `${process.cwd()}/src`,
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    server: {
      host: "::",
      port: 3000,
      proxy: {
        "/supabase": {
          target: env.SUPABASE_URL || env.VITE_SUPABASE_URL || "https://ehvefjyjhnnkiouaawwi.supabase.co",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/supabase/, ""),
        },
      },
    },
  };
});


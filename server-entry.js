import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

// Load .env file if present (Coolify injects runtime vars this way)
try {
  const envContent = readFileSync(".env", "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
} catch (e) {
  // No .env file, that's ok
}

// Dynamic import so env vars are set before module loads
const { default: handler } = await import("./dist/server/server.js");

const port = process.env.PORT || 3000;
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const clientDir = join(__dirname, "dist", "client");

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json",
};

function tryServeStatic(req, res) {
  const url = new URL(req.url, `http://localhost`);
  const pathname = url.pathname;

  // Only serve from /assets/ path (Vite output)
  if (!pathname.startsWith("/assets/") && pathname !== "/favicon.ico") {
    return false;
  }

  const filePath = join(clientDir, pathname);

  try {
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      return false;
    }

    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const content = readFileSync(filePath);

    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": content.length,
      "Cache-Control": pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "public, max-age=3600",
    });
    res.end(content);
    return true;
  } catch {
    return false;
  }
}

const server = createServer(async (req, res) => {
  // Try static files first
  if (tryServeStatic(req, res)) return;

  // Supabase proxy — all client-side Supabase calls go through here to avoid CORS
  if (req.url?.startsWith("/supabase/")) {
    try {
      const supabaseUrl = process.env.SUPABASE_URL || "";
      const targetPath = req.url.replace("/supabase/", "/");
      const targetUrl = supabaseUrl + targetPath;

      const headers = { ...req.headers };
      delete headers.host;
      delete headers.connection;

      const bodyChunks = [];
      req.on("data", (chunk) => bodyChunks.push(chunk));
      await new Promise((resolve) => req.on("end", resolve));
      const body = bodyChunks.length > 0 ? Buffer.concat(bodyChunks) : undefined;

      const proxyRes = await fetch(targetUrl, {
        method: req.method,
        headers,
        body: req.method !== "GET" && req.method !== "HEAD" ? body : undefined,
      });

      const resHeaders = {};
      proxyRes.headers.forEach((value, key) => { resHeaders[key] = value; });
      // Add CORS headers
      resHeaders["access-control-allow-origin"] = "*";
      resHeaders["access-control-allow-methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
      resHeaders["access-control-allow-headers"] = "Authorization, Content-Type, apikey, x-client-info";

      if (req.method === "OPTIONS") {
        res.writeHead(204, resHeaders);
        res.end();
        return;
      }

      res.writeHead(proxyRes.status, resHeaders);
      const responseBody = await proxyRes.arrayBuffer();
      res.end(Buffer.from(responseBody));
      return;
    } catch (e) {
      console.error("[supabase-proxy] Error:", e.message);
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Proxy error" }));
      return;
    }
  }

  // Custom API endpoints (bypass TanStack Start handler)
  if (req.url?.startsWith("/api/auth/")) {
    try {
      const url = new URL(req.url, `http://localhost`);
      const bodyRaw = await new Promise((resolve) => {
        const chunks = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", () => resolve(Buffer.concat(chunks).toString()));
      });
      const body = JSON.parse(bodyRaw);

      const supabaseUrl = process.env.SUPABASE_URL || "";
      const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      let result;
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
        res.writeHead(404);
        res.end("Not Found");
        return;
      }

      res.writeHead(result.error ? 401 : 200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
      return;
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Erro interno", session: null }));
      return;
    }
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }

    const body =
      req.method !== "GET" && req.method !== "HEAD"
        ? await new Promise((resolve) => {
            const chunks = [];
            req.on("data", (chunk) => chunks.push(chunk));
            req.on("end", () => resolve(Buffer.concat(chunks)));
          })
        : undefined;

    const request = new Request(url.toString(), {
      method: req.method,
      headers,
      body,
      duplex: "half",
    });

    // Debug: log server function calls
    if (url.pathname.includes("_server")) {
      console.log(`[server-fn] ${req.method} ${url.pathname}`);
    }

    const response = await (typeof handler === "function" ? handler(request) : handler.fetch(request));

    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));

    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } else {
      const text = await response.text();
      res.end(text);
    }
  } catch (err) {
    console.error("Server error:", err);
    res.writeHead(500);
    res.end("Internal Server Error");
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`🚀 Server listening on http://0.0.0.0:${port}`);
});

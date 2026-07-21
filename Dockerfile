# ─── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Instala dependências
COPY package.json package-lock.json ./
RUN npm ci

# Copia código-fonte e faz build
COPY . .
RUN npm run build

# ─── Production stage ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copia apenas o output do build
COPY --from=builder /app/.output .output
COPY --from=builder /app/package.json .

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]

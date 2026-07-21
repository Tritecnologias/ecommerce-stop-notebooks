# ─── Build stage ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Instala TODAS as dependências (incluindo devDependencies para build)
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# Copia código-fonte e faz build
COPY . .
RUN npm run build

# Instala apenas dependências de produção para o runtime
RUN rm -rf node_modules && npm ci --omit=dev

# ─── Production stage ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copia o output do build + node_modules de produção
COPY --from=builder /app/dist dist
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/package.json .

EXPOSE 3000

CMD ["node", "dist/server/server.js"]

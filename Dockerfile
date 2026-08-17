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

# Copia tudo que o servidor precisa
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json .
COPY --from=builder /app/server-entry.js .

EXPOSE 3000

# Diretório para imagens de produtos (montado como volume)
RUN mkdir -p /data/product-images

CMD ["node", "server-entry.js"]

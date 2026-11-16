# ---------- base ----------
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---------- dev: el código se monta como volumen ----------
FROM base AS dev
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install --no-audit --no-fund
COPY docker/entrypoint-dev.sh /usr/local/bin/entrypoint-dev.sh
RUN chmod +x /usr/local/bin/entrypoint-dev.sh
EXPOSE 3000
CMD ["entrypoint-dev.sh"]

# ---------- build ----------
FROM base AS build
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund
COPY . .
ENV NEXT_STANDALONE=1
RUN npm run build

# ---------- prod ----------
FROM base AS prod
ENV NODE_ENV=production
# CLI de Prisma para aplicar migraciones al arrancar
RUN npm install -g prisma@6.19.3 --no-audit --no-fund
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
EXPOSE 3000
CMD ["sh", "-c", "prisma migrate deploy && node server.js"]

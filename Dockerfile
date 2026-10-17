FROM node:20-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npx next build && node scripts/patch-standalone.mjs

FROM base AS prisma-cli
WORKDIR /opt/prisma-cli
RUN npm install prisma@6.19.3

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=10000

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/lib/constants.ts ./src/lib/constants.ts
COPY --from=builder /app/scripts/trust-proxy.cjs ./scripts/trust-proxy.cjs
COPY --from=builder /app/scripts/render-start.sh ./scripts/render-start.sh
COPY --from=builder /app/scripts/seed-if-empty.mjs ./scripts/seed-if-empty.mjs
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=prisma-cli /opt/prisma-cli/node_modules /opt/prisma-cli/node_modules
COPY --from=builder /app/node_modules/tsx ./node_modules/tsx
COPY --from=builder /app/node_modules/esbuild ./node_modules/esbuild
COPY --from=builder /app/node_modules/@esbuild/linux-x64 ./node_modules/@esbuild/linux-x64
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs

EXPOSE 10000
CMD ["sh", "/app/scripts/render-start.sh"]

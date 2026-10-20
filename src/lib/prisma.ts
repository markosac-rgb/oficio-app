import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Neon en modo transacción no admite prepared statements con nombre. */
export function pooledDatabaseUrl(raw = process.env.DATABASE_URL || "") {
  if (!raw || !/-pooler\./.test(raw) || /(?:^|[?&])pgbouncer=true(?:&|$)/.test(raw)) return raw;
  return raw.includes("?") ? `${raw}&pgbouncer=true` : `${raw}?pgbouncer=true`;
}

const runtimeUrl = pooledDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  (runtimeUrl && runtimeUrl !== process.env.DATABASE_URL
    ? new PrismaClient({ log: ["error"], datasources: { db: { url: runtimeUrl } } })
    : new PrismaClient({ log: ["error"] }));

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

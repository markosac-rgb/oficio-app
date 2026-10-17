import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

let pragmaReady: Promise<void> | null = null;

export function ensureSqlite() {
  if (!pragmaReady) {
    pragmaReady = prisma
      .$queryRawUnsafe("PRAGMA journal_mode=WAL;")
      .then(() => prisma.$queryRawUnsafe("PRAGMA busy_timeout=5000;"))
      .then(() => undefined)
      .catch(() => undefined);
  }
  return pragmaReady;
}

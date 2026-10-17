import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
let count = 0;
try {
  count = await prisma.user.count();
} finally {
  await prisma.$disconnect();
}

if (count > 0) {
  console.log(`La base ya tiene ${count} usuarios. No se siembra de nuevo y no se borra nada.`);
  process.exit(0);
}

console.log("Base vacía. Cargando cuentas y ejemplos ficticios…");
const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"], {
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);

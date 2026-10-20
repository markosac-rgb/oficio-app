import { spawnSync } from "node:child_process";

// Upserts de cuentas demo y ejemplos ficticios. No borra filas ni cuentas reales.
console.log("Aplicando datos de ejemplo de forma idempotente…");
const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"], {
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);

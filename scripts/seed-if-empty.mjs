import { spawnSync } from "node:child_process";

// El disco gratis de Render se borra en cada deploy. La siembra usa upserts:
// vuelve a dejar las cuentas demo y los ejemplos ficticios, sin duplicarlos
// y sin borrar cuentas o trabajos que alguien haya creado.
console.log("Aplicando datos de ejemplo de forma idempotente…");
const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"], {
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);

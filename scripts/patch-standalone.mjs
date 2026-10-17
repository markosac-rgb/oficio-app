import { readFileSync, writeFileSync } from "node:fs";

const target = process.argv[2] || ".next/standalone/server.js";
const marker = "process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(nextConfig)";
const source = readFileSync(target, "utf8");

if (source.includes("nextConfig.experimental.trustHostHeader = true")) {
  console.log(`Ya estaba ajustado: ${target}`);
  process.exit(0);
}
if (!source.includes(marker)) {
  console.error(`No encontré el config embebido en ${target}`);
  process.exit(1);
}

const extra = `nextConfig.experimental = nextConfig.experimental || {}
nextConfig.experimental.trustHostHeader = true
const oficioExtraOrigins = (process.env.OFICIO_ALLOWED_ORIGINS || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean)
nextConfig.experimental.serverActions = nextConfig.experimental.serverActions || {}
nextConfig.experimental.serverActions.allowedOrigins = [
  ...(nextConfig.experimental.serverActions.allowedOrigins || []),
  ...oficioExtraOrigins,
]
`;

writeFileSync(target, source.replace(marker, `${extra}${marker}`));
console.log(`Host del proxy aceptado en ${target}`);

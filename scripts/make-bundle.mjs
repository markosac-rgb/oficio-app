import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const standalone = join(root, ".next", "standalone");
const stage = join(root, ".bundle-stage", "oficio");
const dbDir = join(root, ".bundle-db");
const dbFile = join(dbDir, "oficio.db");

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npx", ["prisma", "generate"]);
run("npx", ["next", "build"]);

rmSync(join(root, ".bundle-stage"), { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
cpSync(standalone, stage, { recursive: true });

const staticSrc = join(root, ".next", "static");
const staticDest = join(stage, ".next", "static");
mkdirSync(dirname(staticDest), { recursive: true });
cpSync(staticSrc, staticDest, { recursive: true });
cpSync(join(root, "public"), join(stage, "public"), { recursive: true });

const engineName = "libquery_engine-debian-openssl-3.0.x.so.node";
const engineSrc = join(root, "node_modules", ".prisma", "client", engineName);
const engineDestDir = join(stage, "node_modules", ".prisma", "client");
mkdirSync(engineDestDir, { recursive: true });
if (!existsSync(engineSrc)) {
  console.error("Falta el motor Prisma debian-openssl-3.0.x");
  process.exit(1);
}
cpSync(engineSrc, join(engineDestDir, engineName));
const clientSrc = join(root, "node_modules", ".prisma", "client");
for (const name of ["index.js", "package.json", "schema.prisma", "default.js", "wasm.js"]) {
  const from = join(clientSrc, name);
  if (existsSync(from)) cpSync(from, join(engineDestDir, name));
}

const prismaClientSrc = join(root, "node_modules", "@prisma", "client");
const prismaClientDest = join(stage, "node_modules", "@prisma", "client");
if (!existsSync(join(prismaClientDest, "package.json"))) {
  cpSync(prismaClientSrc, prismaClientDest, { recursive: true });
}

const { readdirSync, unlinkSync } = await import("node:fs");
function walkDelete(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkDelete(path);
    else if (
      entry.name.endsWith(".map") ||
      entry.name.includes("wasm-base64") ||
      entry.name.endsWith(".wasm")
    ) {
      unlinkSync(path);
    }
  }
}
walkDelete(join(stage, "node_modules", "@prisma"));
walkDelete(join(stage, "node_modules", ".prisma"));

// El servidor destino es glibc x86_64. Sharp trae también musl y wasm.
for (const extra of ["sharp-linuxmusl-x64", "sharp-libvips-linuxmusl-x64", "sharp-wasm32"]) {
  rmSync(join(stage, "node_modules", "@img", extra), { recursive: true, force: true });
}

run("node", ["scripts/patch-standalone.mjs", join(stage, "server.js")]);

rmSync(dbDir, { recursive: true, force: true });
mkdirSync(dbDir, { recursive: true });
const databaseUrl = `file:${dbFile}`;
run("npx", ["prisma", "migrate", "deploy"], { DATABASE_URL: databaseUrl });
run("npx", ["tsx", "prisma/seed.ts"], { DATABASE_URL: databaseUrl });
run("node", ["--input-type=module", "-e", `
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
await prisma.$queryRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE);");
await prisma.$disconnect();
`], { DATABASE_URL: databaseUrl });

mkdirSync(join(stage, "data"), { recursive: true });
cpSync(dbFile, join(stage, "data", "oficio.db"));
cpSync(join(root, "scripts", "trust-proxy.cjs"), join(stage, "trust-proxy.cjs"));
cpSync(join(root, "scripts", "start-standalone.sh"), join(stage, "start.sh"));
spawnSync("chmod", ["755", join(stage, "start.sh")], { stdio: "inherit" });

const out = process.env.BUNDLE_OUT || "/opt/cursor/artifacts/oficio-bundle.tar.gz";
mkdirSync(dirname(out), { recursive: true });
run("tar", ["-czf", out, "-C", join(root, ".bundle-stage"), "oficio"]);
const size = statSync(out).size;
console.log(`Paquete: ${out} (${(size / 1024 / 1024).toFixed(1)} MB)`);

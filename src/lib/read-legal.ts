import { readFileSync } from "node:fs";
import { join } from "node:path";

export function readLegal(name: "terminos.md" | "aviso-privacidad.md") {
  return readFileSync(join(process.cwd(), "docs", "legal", name), "utf8");
}

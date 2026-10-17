import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyLegalParty } from "@/lib/legal-party";

export function readLegal(name: "terminos.md" | "aviso-privacidad.md") {
  return applyLegalParty(readFileSync(join(process.cwd(), "docs", "legal", name), "utf8"));
}

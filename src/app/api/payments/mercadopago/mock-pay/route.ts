import type { NextRequest } from "next/server";
import { mockRecordOutcome } from "@/server/mp-mock";

export async function POST(request: NextRequest) {
  if (process.env.MP_MOCK !== "1") {
    return Response.json({ error: "No disponible." }, { status: 404 });
  }
  const body = (await request.json().catch(() => ({}))) as { preferenceId?: string; paymentId?: string; outcome?: string };
  const outcome = body.outcome || "approved";
  if (!["approved", "pending", "rejected", "refunded"].includes(outcome)) {
    return Response.json({ error: "Resultado no válido." }, { status: 400 });
  }
  const recorded = mockRecordOutcome({ preferenceId: body.preferenceId, paymentId: body.paymentId, outcome });
  if (!recorded) return Response.json({ error: "No hay un checkout de prueba con ese identificador." }, { status: 404 });
  return Response.json(recorded);
}

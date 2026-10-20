import type { NextRequest } from "next/server";
import { verifyWebhookSignature, webhookPaymentId } from "@/server/mercadopago";
import { syncMercadoPagoPayment } from "@/server/payments";

export async function POST(request: NextRequest) {
  if (!verifyWebhookSignature(request.headers, request.nextUrl.searchParams)) {
    return Response.json({ error: "Firma inválida." }, { status: 401 });
  }
  let body: Record<string, unknown> = {};
  const text = await request.text();
  if (text) {
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return Response.json({ error: "Aviso ilegible." }, { status: 400 });
    }
  }
  const type = String(body.type || body.topic || request.nextUrl.searchParams.get("type") || request.nextUrl.searchParams.get("topic") || "");
  if (type && type !== "payment" && !type.startsWith("payment")) {
    return Response.json({ ok: true, ignored: true });
  }
  const paymentId = webhookPaymentId(request.nextUrl.searchParams, body);
  if (!paymentId) return Response.json({ ok: true, ignored: true });
  try {
    const result = await syncMercadoPagoPayment(paymentId);
    return Response.json(result);
  } catch (error) {
    if (error instanceof Error && (error.name === "MPNotFoundError" || /not.?found/i.test(error.message))) {
      // Pago inexistente (p. ej. simulación de Mercado Pago): se acepta y se ignora.
      return Response.json({ ok: true, ignored: true, reason: "payment_not_found" });
    }
    console.error(error);
    return Response.json({ error: "No se pudo confirmar el pago con Mercado Pago." }, { status: 500 });
  }
}

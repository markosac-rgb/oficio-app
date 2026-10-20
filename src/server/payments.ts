import { randomUUID } from "crypto";
import { commissionOf } from "@/lib/commission";
import { POLICY_VERSION } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/server/errors";
import {
  createCheckoutPreference,
  fetchRemotePayment,
  mpConfigured,
  mpOAuthConfigured,
  mpTestMode,
  refreshSellerToken,
  type RemotePayment,
} from "@/server/mercadopago";

function platformNote(pct: number) {
  return `Ofixio recibe este pago en su cuenta de Mercado Pago y después le paga al proveedor. La comisión configurada es ${pct}%. No es un depósito ni una custodia: Ofixio no retiene el dinero en garantía. Las devoluciones y las disputas de este pago se atienden en Mercado Pago, con las reglas de Mercado Pago. Ofixio no ofrece una protección al comprador distinta de la que Mercado Pago publique.`;
}

const PROVIDER_NOTE =
  "Este pago entra a la cuenta de Mercado Pago del proveedor. Si hay comisión, Mercado Pago se la descuenta de ese monto y se la abona a Ofixio. Las devoluciones y las disputas se atienden en Mercado Pago. Ofixio no retiene el dinero ni ofrece un depósito en garantía.";

async function notify(userId: string, title: string, body: string, href: string) {
  await prisma.notification.create({
    data: { id: randomUUID(), userId, title, body: body.slice(0, 180), href },
  });
}

async function sellerAccessToken(providerId: string) {
  const provider = await prisma.providerProfile.findUnique({ where: { id: providerId } });
  if (!provider?.mpAccessToken) return null;
  const expires = provider.mpTokenExpiresAt?.getTime() ?? 0;
  if (provider.mpRefreshToken && expires > 0 && expires < Date.now() + 60_000) {
    const refreshed = await refreshSellerToken(provider.mpRefreshToken);
    if (!refreshed.access_token) return provider.mpAccessToken;
    const nextExpiry = new Date(Date.now() + Number(refreshed.expires_in ?? 15_552_000) * 1000);
    await prisma.providerProfile.update({
      where: { id: providerId },
      data: {
        mpAccessToken: refreshed.access_token,
        mpRefreshToken: refreshed.refresh_token || provider.mpRefreshToken,
        mpPublicKey: refreshed.public_key || provider.mpPublicKey,
        mpTokenExpiresAt: nextExpiry,
      },
    });
    return refreshed.access_token;
  }
  return provider.mpAccessToken;
}

export async function startMercadoPagoCheckout(input: {
  requestId: string;
  clientId: string;
  clientEmail: string;
  providerId: string;
  providerUserId: string;
  title: string;
  serviceMxn: number;
  origin: string;
}) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new HttpError(400, "Mercado Pago no está configurado.");
  const sellerToken = await sellerAccessToken(input.providerId);
  const money = commissionOf(input.serviceMxn);
  const connected = Boolean(sellerToken);
  const accessToken = sellerToken || token;
  const marketplaceFee = connected && money.feeMxn > 0 ? money.feeMxn : null;
  const payee = connected ? "provider" : "platform";
  const created = await createCheckoutPreference({
    accessToken,
    requestId: input.requestId,
    title: input.title,
    amountMxn: money.totalMxn,
    marketplaceFeeMxn: marketplaceFee,
    origin: input.origin,
    payerEmail: input.clientEmail || undefined,
  });
  const note = connected ? PROVIDER_NOTE : platformNote(money.pct);
  const testMode = await mpTestMode();
  const existing = await prisma.payment.findUnique({ where: { requestId: input.requestId } });
  if (existing && ["approved", "pending", "refunded"].includes(existing.status)) {
    throw new HttpError(400, "Este servicio ya tiene un pago en Mercado Pago.");
  }
  if (existing) {
    await prisma.payment.update({
      where: { id: existing.id },
      data: {
        method: "MP",
        serviceMxn: money.serviceMxn,
        feeMxn: money.feeMxn,
        totalMxn: money.totalMxn,
        status: "checkout",
        simulated: false,
        adapter: "mercadopago",
        reference: created.preferenceId,
        preferenceId: created.preferenceId,
        payee,
        note,
        liveMode: !testMode,
        externalPaymentId: null,
      },
    });
  } else {
    await prisma.payment.create({
      data: {
        id: randomUUID(),
        requestId: input.requestId,
        method: "MP",
        serviceMxn: money.serviceMxn,
        feeMxn: money.feeMxn,
        totalMxn: money.totalMxn,
        status: "checkout",
        simulated: false,
        adapter: "mercadopago",
        reference: created.preferenceId,
        preferenceId: created.preferenceId,
        payee,
        note,
        policyVersion: POLICY_VERSION,
        liveMode: !testMode,
      },
    });
  }
  return { ok: true, redirectUrl: created.url, testMode, payee };
}

export async function syncMercadoPagoPayment(paymentId: string) {
  if (!mpConfigured()) throw new HttpError(400, "Mercado Pago no está configurado.");
  const remote = await fetchRemotePayment(paymentId, process.env.MP_ACCESS_TOKEN || "");
  if (!remote.externalReference) throw new HttpError(404, "Ese pago no corresponde a un servicio.");
  return applyRemotePayment(remote);
}

async function applyRemotePayment(remote: RemotePayment) {
  const request = await prisma.serviceRequest.findUnique({
    where: { id: remote.externalReference },
    include: {
      payment: true,
      quotes: { include: { provider: true } },
    },
  });
  if (!request?.payment) return { ok: true, ignored: true as const, requestId: remote.externalReference };
  const payment = request.payment;
  const same =
    payment.externalPaymentId === remote.id &&
    payment.status === remote.status &&
    payment.totalMxn === remote.amountMxn &&
    payment.method === remote.method;
  if (same) return { ok: true, idempotent: true as const, requestId: request.id, status: remote.status };

  const selected = request.quotes.find((quote) => quote.id === request.selectedQuoteId);
  let confirmed = false;
  await prisma.$transaction(async (tx) => {
    const current = await tx.payment.findUnique({ where: { id: payment.id } });
    if (!current) return;
    if (
      current.externalPaymentId === remote.id &&
      current.status === remote.status &&
      current.totalMxn === remote.amountMxn &&
      current.method === remote.method
    ) {
      return;
    }
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        externalPaymentId: remote.id,
        method: remote.method,
        methodDetail: remote.methodDetail,
        totalMxn: remote.amountMxn,
        status: remote.status,
        ticketUrl: remote.ticketUrl,
        liveMode: remote.liveMode,
        simulated: false,
        adapter: "mercadopago",
        reference: remote.id,
      },
    });
    await tx.paymentEvent.upsert({
      where: { paymentId_status: { paymentId: payment.id, status: remote.status } },
      update: { detail: remote.statusDetail },
      create: {
        id: randomUUID(),
        paymentId: payment.id,
        status: remote.status,
        detail: remote.statusDetail,
      },
    });
    if (remote.status === "approved" && request.status === "QUOTED") {
      const updated = await tx.serviceRequest.updateMany({
        where: { id: request.id, status: "QUOTED" },
        data: { status: "CONFIRMED" },
      });
      confirmed = updated.count === 1;
    }
  });

  if (confirmed && selected) {
    const payeeNote =
      payment.payee === "provider"
        ? "El pago quedó aprobado en la cuenta de Mercado Pago del proveedor."
        : "El pago quedó aprobado en la cuenta de Mercado Pago de Ofixio. Ofixio te paga el monto acordado. No es un depósito.";
    await notify(selected.provider.userId, "Pago aprobado", `${payeeNote} Ya puedes ver la dirección.`, `/solicitudes/${request.id}`);
    await notify(request.clientId, "Pago aprobado", "Mercado Pago aprobó el pago. El trabajo quedó confirmado.", `/solicitudes/${request.id}/pago`);
  }
  if (remote.status === "refunded") {
    await notify(
      request.clientId,
      "Reembolso en Mercado Pago",
      "Mercado Pago marcó este pago como reembolsado. Ofixio no procesa esa devolución.",
      `/solicitudes/${request.id}/pago`,
    );
    if (selected) {
      await notify(
        selected.provider.userId,
        "Reembolso en Mercado Pago",
        "Mercado Pago marcó el pago como reembolsado. La devolución la atiende Mercado Pago.",
        `/solicitudes/${request.id}`,
      );
    }
  }
  return { ok: true, idempotent: false as const, requestId: request.id, status: remote.status };
}

export { mpConfigured, mpOAuthConfigured, mpTestMode };

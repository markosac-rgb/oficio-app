ALTER TABLE "ProviderProfile" ADD COLUMN "mpUserId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ProviderProfile" ADD COLUMN "mpAccessToken" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ProviderProfile" ADD COLUMN "mpRefreshToken" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ProviderProfile" ADD COLUMN "mpPublicKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ProviderProfile" ADD COLUMN "mpTokenExpiresAt" TIMESTAMP(3);

ALTER TABLE "Payment" ADD COLUMN "externalPaymentId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "preferenceId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Payment" ADD COLUMN "payee" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "Payment" ADD COLUMN "methodDetail" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Payment" ADD COLUMN "ticketUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Payment" ADD COLUMN "liveMode" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "Payment_externalPaymentId_key" ON "Payment"("externalPaymentId");

CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentEvent_paymentId_status_key" ON "PaymentEvent"("paymentId", "status");
CREATE INDEX "PaymentEvent_paymentId_idx" ON "PaymentEvent"("paymentId");

ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

import { PAYMENT_METHODS, type PaymentMethodId } from "@/lib/constants";

/**
 * Payment adapter. The demo records a choice. It does not charge a card,
 * create an OXXO slip, or hold funds.
 * Replace `demoPaymentAdapter` with Conekta, Stripe MX, Mercado Pago, or OpenPay.
 */
export interface PaymentIntent {
  requestId: string;
  method: PaymentMethodId;
  serviceMxn: number;
  feeMxn: number;
  totalMxn: number;
}

export interface PaymentAdapterResult {
  adapter: "demo";
  simulated: true;
  status: "registrado_simulado";
  reference: string;
  externalProviderNeeded: string;
  note: string;
}

export interface PaymentAdapter {
  id: "demo";
  record(input: PaymentIntent): Promise<PaymentAdapterResult>;
}

export const demoPaymentAdapter: PaymentAdapter = {
  id: "demo",
  async record(input) {
    const method = PAYMENT_METHODS.find((item) => item.id === input.method);
    const reference = `DEMO-NO-COBRAR-${input.requestId.slice(0, 8).toUpperCase()}`;
    return {
      adapter: "demo",
      simulated: true,
      status: "registrado_simulado",
      reference,
      externalProviderNeeded: method?.external ?? "Pasarela de pago en México",
      note: "Registro de demostración. No hubo cobro ni custodia de dinero.",
    };
  },
};

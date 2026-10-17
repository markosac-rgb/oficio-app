/**
 * OTP delivery. The demo never sends SMS or email.
 * Replace with Twilio (or similar) for SMS and a transactional email provider.
 */
export interface OtpDelivery {
  delivered: false;
  simulated: true;
  channel: "sms" | "email";
  demoCode: string;
  externalProviderNeeded: string;
}

export interface OtpAdapter {
  deliver(target: string, code: string): Promise<OtpDelivery>;
}

export const demoOtpAdapter: OtpAdapter = {
  async deliver(target, code) {
    const channel = target.includes("@") ? "email" : "sms";
    return {
      delivered: false,
      simulated: true,
      channel,
      demoCode: code,
      externalProviderNeeded:
        channel === "sms"
          ? "Twilio, MessageBird u otro proveedor de SMS en México."
          : "Un servicio de correo transaccional (por ejemplo, el de tu pasarela o Resend).",
    };
  },
};

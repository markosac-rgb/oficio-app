/**
 * Identity adapter. Submitting a document never verifies anyone.
 * An admin must mark the review inside Oficio.
 * A production KYC vendor (INE check) would replace this submit step,
 * and a person should still be able to reject the result.
 */
export interface IdentitySubmission {
  providerId: string;
  kind: "INE" | "CERT" | "REFERENCE";
  label: string;
}

export interface IdentityAdapter {
  mode: "simulated";
  externalProviderNeeded: string;
  submit(input: IdentitySubmission): Promise<{
    status: "pending";
    simulated: true;
    message: string;
  }>;
}

export const demoIdentityAdapter: IdentityAdapter = {
  mode: "simulated",
  externalProviderNeeded:
    "Un proveedor de verificación de identidad que revise INE u otra identificación oficial.",
  async submit() {
    return {
      status: "pending",
      simulated: true,
      message:
        "Quedó anotado como pendiente. Nadie queda verificado hasta que administración lo marque como revisado.",
    };
  },
};

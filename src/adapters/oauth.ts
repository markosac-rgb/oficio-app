/**
 * Google sign-in adapter. The demo does not open Google.
 * Replace with Google OAuth (Cloud console client + redirect URI).
 */
export interface SimulatedGoogleProfile {
  email: string;
  name: string;
  role: "CLIENT" | "PROVIDER";
}

export interface OAuthResult {
  simulated: true;
  provider: "google";
  externalProviderNeeded: string;
  profile: SimulatedGoogleProfile;
}

export interface OAuthAdapter {
  start(role: "CLIENT" | "PROVIDER"): OAuthResult;
}

export const demoGoogleAdapter: OAuthAdapter = {
  start(role) {
    const needed = "Google OAuth: cliente en Google Cloud y URL de retorno de Oficio.";
    if (role === "PROVIDER") {
      return {
        simulated: true,
        provider: "google",
        externalProviderNeeded: needed,
        profile: {
          email: "google.proveedor@oficio.demo",
          name: "Proveedor Google Demo",
          role,
        },
      };
    }
    return {
      simulated: true,
      provider: "google",
      externalProviderNeeded: needed,
      profile: {
        email: "google.cliente@oficio.demo",
        name: "Cliente Google Demo",
        role: "CLIENT",
      },
    };
  },
};

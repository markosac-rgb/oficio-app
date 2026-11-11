import { MOBILE_APP_ID, publicAppUrl } from "@/lib/mobile";

export async function isNativeApp() {
  if (typeof window === "undefined") return false;
  const { Capacitor } = await import("@capacitor/core");
  return Capacitor.isNativePlatform();
}

export async function currentPosition() {
  if (await isNativeApp()) {
    const { Geolocation } = await import("@capacitor/geolocation");
    const perm = await Geolocation.requestPermissions();
    if (perm.location === "denied") throw new Error("El permiso de ubicación está apagado.");
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 12000 });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  }
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("Este navegador no comparte la ubicación.");
  }
  return new Promise<{ lat: number; lng: number }>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error("No pudimos leer tu ubicación.")),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 },
    );
  });
}

export async function shareLink(input: { title: string; text: string; url: string }) {
  if (await isNativeApp()) {
    const { Share } = await import("@capacitor/share");
    await Share.share({ title: input.title, text: input.text, url: input.url, dialogTitle: input.title });
    return "shared" as const;
  }
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    await navigator.share(input);
    return "shared" as const;
  }
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(input.url);
    return "copied" as const;
  }
  return "unavailable" as const;
}

export async function registerDevicePush(onToken: (token: string, platform: "ios" | "android") => void) {
  if (!(await isNativeApp())) return;
  const { Capacitor } = await import("@capacitor/core");
  const { PushNotifications } = await import("@capacitor/push-notifications");
  const current = await PushNotifications.checkPermissions();
  const perm = current.receive === "granted" ? current : await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") return;
  const platform = Capacitor.getPlatform() === "ios" ? "ios" : "android";
  await PushNotifications.addListener("registration", (token) => {
    if (token.value) onToken(token.value, platform);
  });
  await PushNotifications.addListener("registrationError", () => {
    /* sin FCM o sin APNs el registro falla y la app sigue */
  });
  await PushNotifications.register();
}

export async function appleNativeSignIn() {
  const { SignInWithApple } = await import("@capacitor-community/apple-sign-in");
  return SignInWithApple.authorize({
    clientId: MOBILE_APP_ID,
    redirectURI: `${publicAppUrl()}/api/auth/apple/callback`,
    scopes: "email name",
  });
}

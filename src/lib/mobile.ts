export const MOBILE_APP_ID = "mx.ofixio.app";
export const MOBILE_APP_NAME = "Ofixio";
export const DEFAULT_PUBLIC_URL = "https://oficio-app.onrender.com";

export function publicAppUrl() {
  return (process.env.OFICIO_PUBLIC_URL || DEFAULT_PUBLIC_URL).replace(/\/$/, "");
}

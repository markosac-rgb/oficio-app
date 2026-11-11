import type { CapacitorConfig } from "@capacitor/cli";
import { MOBILE_APP_ID, MOBILE_APP_NAME, publicAppUrl } from "./src/lib/mobile";

const config: CapacitorConfig = {
  appId: MOBILE_APP_ID,
  appName: MOBILE_APP_NAME,
  webDir: "mobile/www",
  server: {
    url: publicAppUrl(),
    errorPath: "offline.html",
    androidScheme: "https",
    allowNavigation: ["oficio-app.onrender.com", "*.onrender.com"],
  },
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: "automatic",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#062F35",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;

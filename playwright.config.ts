import { defineConfig, devices } from "@playwright/test";

// Next a veces deja una fuente en "loading" y la captura se queda esperando.
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY ||= "1";

export default defineConfig({
  testDir: "e2e",
  timeout: 240_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:43123",
    locale: "es-MX",
    ...devices["Pixel 7"],
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  },
  webServer: {
    command:
      "MP_MOCK=1 MP_ACCESS_TOKEN=TEST-ofixio-e2e MP_PUBLIC_KEY=TEST-public MP_WEBHOOK_SECRET=ofixio-e2e-webhook OFIXIO_COMMISSION_PCT=0 npm run iniciar",
    url: "http://127.0.0.1:43123/api/health",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});

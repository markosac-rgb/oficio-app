import { defineConfig, devices } from "@playwright/test";

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
  },
  webServer: {
    command: "npm run iniciar",
    url: "http://127.0.0.1:43123/api/health",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});

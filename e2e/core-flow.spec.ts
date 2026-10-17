import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const shots = "/opt/cursor/artifacts/screenshots";

async function shot(page: import("@playwright/test").Page, name: string) {
  await page.screenshot({ path: `${shots}/${name}.png` });
}

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/entrar");
  await page.getByTestId("login-identifier").fill(email);
  await page.getByTestId("login-password").fill("demo1234");
  await page.getByTestId("login-submit").click();
  await page.waitForURL("**/inicio");
}

test("cliente pide, proveedor cotiza, confirman, registran pago, terminan y reseñan", async ({ page }) => {
  await mkdir(shots, { recursive: true });
  const stamp = `fuga-lavabo-${Date.now()}`;
  const description = `Hay una fuga constante bajo el lavabo ${stamp}. El agua cae al piso.`;

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Alguien de confianza/ })).toBeVisible();
  await shot(page, "01-bienvenida");
  await page.getByTestId("go-login").click();
  await expect(page.getByTestId("demo-accounts")).toBeVisible();
  await shot(page, "02-entrar");

  await login(page, "ana.lopez@oficio.demo");
  await expect(page.getByRole("heading", { name: "Ana" })).toBeVisible();
  await expect(page.getByText("¿Qué necesitas hoy?")).toBeVisible();
  await expect(page.getByText("Datos de ejemplo").first()).toBeVisible();
  await shot(page, "03-inicio");
  await shot(page, "home-cliente");
  const nearbyMap = page.getByTestId("nearby-map");
  await nearbyMap.scrollIntoViewIfNeeded();
  await expect(nearbyMap).toContainText("OpenStreetMap");
  await shot(page, "03b-mapa-cerca");

  await page.getByTestId("nav-solicitudes").click();
  await expect(page.getByRole("heading", { name: "Reservas" })).toBeVisible();
  await shot(page, "04-solicitudes");
  await shot(page, "reservas");

  await page.getByTestId("nav-buscar").click();
  await page.getByTestId("search-input").fill("Jorge");
  await page.getByTestId("search-submit").click();
  await expect(page.getByTestId("provider-prov_jorge")).toBeVisible();
  await page.getByTestId("buscar-map").scrollIntoViewIfNeeded();
  await expect(page.getByTestId("buscar-map")).toContainText("OpenStreetMap");
  await shot(page, "explorar");
  await shot(page, "05b-mapa-buscar");
  await shot(page, "05-buscar");
  await page.getByTestId("provider-prov_jorge").click();
  await expect(page.getByRole("heading", { name: "Jorge Ramírez" })).toBeVisible();
  await expect(page.getByText("Ejemplo ficticio").first()).toBeVisible();
  await expect(page.getByText("Identidad sin verificar")).toBeVisible();
  await shot(page, "06-perfil-proveedor");
  await shot(page, "perfil-proveedor");

  await page.getByTestId("request-service-svc_jorge_fuga").click();
  await expect(page.getByText("Reparación de fuga")).toBeVisible();
  await expect(page.getByTestId("address-street")).toHaveValue(/Durazno/);
  await page.getByTestId("request-description").fill(description);
  await page.getByTestId("location-map").scrollIntoViewIfNeeded();
  await expect(page.getByTestId("location-map")).toContainText("OpenStreetMap");
  await shot(page, "07b-mapa-direccion");
  await shot(page, "07-solicitar");
  await page.getByTestId("request-submit").click();
  await expect(page.getByText(description)).toBeVisible();
  await expect(page.getByTestId("request-success")).toBeVisible();
  await expect(page.getByText("Solicitado").first()).toBeVisible();
  await shot(page, "solicitud-enviada");
  await expect(page.getByTestId("zone-map")).toBeVisible();
  await expect(page.getByTestId("exact-map")).toHaveCount(0);
  const requestUrl = page.url();
  await page.getByTestId("zone-map").scrollIntoViewIfNeeded();
  await shot(page, "08b-mapa-zona");
  await shot(page, "08-solicitud");

  await login(page, "jorge.ramirez@oficio.demo");
  await page.goto("/panel");
  await expect(page.getByText(stamp)).toBeVisible();
  await page.getByRole("heading", { name: "Tu panel" }).scrollIntoViewIfNeeded();
  await shot(page, "09-panel-proveedor");
  await shot(page, "panel-proveedor");
  await page.getByTestId("provider-request").filter({ hasText: stamp }).first().click();
  await expect(page.getByTestId("address-hidden")).toBeVisible();
  await expect(page.getByTestId("zone-map")).toBeVisible();
  await expect(page.getByTestId("exact-map")).toHaveCount(0);
  await expect(page.getByText("Calle Durazno 123")).toHaveCount(0);
  await expect(page.getByText("depto 4")).toHaveCount(0);
  await page.getByTestId("quote-amount").fill("850");
  await page.getByTestId("quote-message").fill("Reviso la fuga y cambio la pieza si hace falta.");
  await page.getByTestId("quote-eta").fill("45");
  await page.getByTestId("quote-submit").click();
  await expect(page.getByText("$850 MXN")).toBeVisible();

  await login(page, "ana.lopez@oficio.demo");
  await page.goto(requestUrl);
  await expect(page.getByText("$850 MXN")).toBeVisible();
  await shot(page, "10-cotizacion");
  await page.getByTestId("accept-quote").click();
  await page.getByTestId("confirm-accept").click();
  await expect(page.getByTestId("schedule-date")).toBeVisible();
  await page.getByTestId("schedule-date").fill("2026-10-20");
  await page.getByTestId("schedule-time").fill("10:00");
  await shot(page, "11-agenda");
  await page.getByTestId("schedule-submit").click();
  await expect(page.getByTestId("go-pay")).toBeVisible();
  await page.getByTestId("go-pay").click();
  await expect(page.getByTestId("fee-breakdown")).toContainText("Costo del servicio: $850 MXN");
  await expect(page.getByTestId("fee-breakdown")).toContainText("Comisión de la plataforma (10%): $85 MXN");
  await expect(page.getByTestId("demo-banner")).toBeVisible();
  await shot(page, "12-pago");
  await page.getByTestId("pay-CASH").check();
  await page.getByTestId("pay-policy").check();
  await page.getByTestId("pay-submit").click();
  await expect(page.getByTestId("receipt")).toBeVisible();
  await expect(page.getByText("DEMO-NO-COBRAR")).toBeVisible();
  await expect(page.getByText(/no hubo cobro/i).first()).toBeVisible();
  await shot(page, "13-recibo");

  await page.goto(requestUrl);
  await page.getByTestId("open-chat").click();
  await page.getByTestId("chat-input").fill("Ya confirmé la visita de las 10.");
  await page.getByTestId("chat-send").click();
  await expect(page.getByText("Ya confirmé la visita de las 10.")).toBeVisible();
  await shot(page, "14-chat");
  await page.goto("/mensajes");
  await expect(page.getByRole("heading", { name: "Mensajes" })).toBeVisible();
  await shot(page, "mensajes");

  await login(page, "jorge.ramirez@oficio.demo");
  await page.goto(requestUrl);
  await expect(page.getByTestId("exact-address")).toContainText("Calle Durazno 123");
  await expect(page.getByTestId("exact-address")).toContainText("depto 4");
  await expect(page.getByTestId("exact-map")).toBeVisible();
  await page.getByTestId("exact-map").scrollIntoViewIfNeeded();
  await shot(page, "15b-mapa-exacto");
  await shot(page, "15-seguimiento-proveedor");
  await page.getByTestId("status-next").click();
  await expect(page.getByTestId("status-next")).toHaveText(/empecé/i);
  await page.getByTestId("status-next").click();
  await expect(page.getByTestId("status-next")).toHaveText(/terminado/i);
  await page.getByTestId("status-next").click();
  await expect(page.getByText("Completado").first()).toBeVisible();

  await login(page, "ana.lopez@oficio.demo");
  await page.goto(`${requestUrl}/calificar`);
  await page.getByTestId("star-5").click();
  await page.getByTestId("review-comment").fill("Dejó el lavabo sin fuga y explicó el precio.");
  await shot(page, "16-calificar");
  await page.getByTestId("review-submit").click();
  await expect(page.getByTestId("review-thanks")).toBeVisible();
  await shot(page, "17-resena-hecha");
  await page.goto("/proveedores/prov_jorge");
  await expect(page.getByText("Dejó el lavabo sin fuga y explicó el precio.").first()).toBeVisible();
  await expect(page.getByText("Cuenta demo").first()).toBeVisible();

  await page.goto("/ayuda");
  await expect(page.getByRole("heading", { name: "Ayuda" })).toBeVisible();
  await shot(page, "18-ayuda");
  await page.goto("/perfil");
  await shot(page, "19-perfil");
  await shot(page, "perfil");

  await login(page, "admin@oficio.demo");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Administración" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Marcar identidad verificada" }).first()).toBeVisible();
  await shot(page, "20-admin");
  await shot(page, "admin");
});

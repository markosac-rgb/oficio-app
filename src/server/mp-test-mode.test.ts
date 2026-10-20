import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { clearMpTestModeCache, createCheckoutPreference, mpTestMode } from "./mercadopago";

const originalFetch = globalThis.fetch;
const envKeys = ["MP_TEST_MODE", "MP_ACCESS_TOKEN"] as const;
const saved = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

afterEach(() => {
  globalThis.fetch = originalFetch;
  clearMpTestModeCache();
  for (const key of envKeys) {
    const value = saved[key];
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("mpTestMode", () => {
  test("MP_TEST_MODE=1 enciende la prueba sin consultar /users/me", async () => {
    process.env.MP_TEST_MODE = "1";
    process.env.MP_ACCESS_TOKEN = "APP_USR-cuenta-prueba";
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return json({ tags: ["normal"] });
    };
    assert.equal(await mpTestMode(), true);
    assert.equal(calls, 0);
  });

  test("MP_TEST_MODE=0 apaga la prueba aunque el token empiece con TEST-", async () => {
    process.env.MP_TEST_MODE = "0";
    process.env.MP_ACCESS_TOKEN = "TEST-viejo";
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return json({ tags: ["test_user"] });
    };
    assert.equal(await mpTestMode(), false);
    assert.equal(calls, 0);
  });

  test("sin la variable, un token TEST- no llama a /users/me", async () => {
    delete process.env.MP_TEST_MODE;
    process.env.MP_ACCESS_TOKEN = "TEST-ofixio";
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return json({ tags: [] });
    };
    assert.equal(await mpTestMode(), true);
    assert.equal(calls, 0);
  });

  test("sin la variable, APP_USR- usa la etiqueta test_user y cachea la respuesta", async () => {
    delete process.env.MP_TEST_MODE;
    process.env.MP_ACCESS_TOKEN = "APP_USR-ofixio-e2e";
    let calls = 0;
    globalThis.fetch = async (input) => {
      calls += 1;
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      assert.equal(url, "https://api.mercadopago.com/users/me");
      return json({ id: 7, tags: ["normal", "test_user"] });
    };
    assert.equal(await mpTestMode(), true);
    assert.equal(await mpTestMode(), true);
    assert.equal(calls, 1);
  });

  test("sin la etiqueta test_user no es modo de prueba", async () => {
    delete process.env.MP_TEST_MODE;
    process.env.MP_ACCESS_TOKEN = "APP_USR-produccion";
    globalThis.fetch = async () => json({ tags: ["normal"] });
    assert.equal(await mpTestMode(), false);
  });
});

describe("checkout sandbox", () => {
  test("en prueba usa sandbox_init_point si viene en la respuesta", async () => {
    process.env.MP_TEST_MODE = "1";
    process.env.MP_ACCESS_TOKEN = "APP_USR-cuenta-prueba";
    globalThis.fetch = async () =>
      json({
        id: "pref_1",
        init_point: "https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=pref_1",
        sandbox_init_point: "http://127.0.0.1:43123/pago/mercadopago/prueba?preference_id=pref_1",
      });
    const created = await createCheckoutPreference({
      accessToken: "APP_USR-cuenta-prueba",
      requestId: "req_1",
      title: "Fuga",
      amountMxn: 850,
      marketplaceFeeMxn: null,
      origin: "http://127.0.0.1:43123",
    });
    assert.equal(created.url, "http://127.0.0.1:43123/pago/mercadopago/prueba?preference_id=pref_1");
  });

  test("apagado usa init_point aunque exista sandbox_init_point", async () => {
    process.env.MP_TEST_MODE = "0";
    process.env.MP_ACCESS_TOKEN = "APP_USR-produccion";
    globalThis.fetch = async () =>
      json({
        id: "pref_2",
        init_point: "https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=pref_2",
        sandbox_init_point: "http://127.0.0.1:43123/pago/mercadopago/prueba?preference_id=pref_2",
      });
    const created = await createCheckoutPreference({
      accessToken: "APP_USR-produccion",
      requestId: "req_2",
      title: "Fuga",
      amountMxn: 850,
      marketplaceFeeMxn: null,
      origin: "http://127.0.0.1:43123",
    });
    assert.equal(created.url, "https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=pref_2");
  });

  test("en prueba, sin sandbox_init_point, usa init_point", async () => {
    process.env.MP_TEST_MODE = "1";
    process.env.MP_ACCESS_TOKEN = "APP_USR-cuenta-prueba";
    globalThis.fetch = async () =>
      json({
        id: "pref_3",
        init_point: "https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=pref_3",
      });
    const created = await createCheckoutPreference({
      accessToken: "APP_USR-cuenta-prueba",
      requestId: "req_3",
      title: "Fuga",
      amountMxn: 850,
      marketplaceFeeMxn: null,
      origin: "http://127.0.0.1:43123",
    });
    assert.equal(created.url, "https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=pref_3");
  });
});

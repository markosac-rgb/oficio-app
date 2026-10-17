"use strict";

// Alinea Host con el host público cuando un túnel HTTPS reescribe Host a
// 127.0.0.1 o localhost. No cambia un Host que ya es público: así un Origin
// de otro sitio no pasa la revisión de Next.

const http = require("http");

function first(value) {
  if (!value) return "";
  const raw = Array.isArray(value) ? value[0] : String(value);
  return raw.split(",")[0].trim();
}

function isInternal(host) {
  if (!host) return true;
  const name = host.replace(/^\[|\]$/g, "").split(":")[0].toLowerCase();
  return name === "localhost" || name === "127.0.0.1" || name === "0.0.0.0" || name === "::1";
}

function originHost(origin) {
  if (!origin || origin === "null") return "";
  try {
    return new URL(origin).host;
  } catch {
    return "";
  }
}

function align(req) {
  const headers = req.headers;
  if (!headers) return;
  const host = first(headers.host);
  const forwarded = first(headers["x-forwarded-host"]);
  const fromOrigin = originHost(first(headers.origin));
  const trustOrigin = process.env.OFICIO_TRUST_ORIGIN !== "0";

  let publicHost = forwarded;
  if (!publicHost && trustOrigin && isInternal(host) && fromOrigin) {
    publicHost = fromOrigin;
  }

  if (publicHost && isInternal(host)) {
    headers.host = publicHost;
    headers["x-forwarded-host"] = publicHost;
  } else if (publicHost && !headers["x-forwarded-host"]) {
    headers["x-forwarded-host"] = publicHost;
  }

  if (!headers["x-forwarded-proto"]) {
    const origin = first(headers.origin);
    if (origin.startsWith("https://") || (publicHost && !isInternal(publicHost))) {
      headers["x-forwarded-proto"] = "https";
    }
  }
}

const original = http.Server.prototype.emit;
http.Server.prototype.emit = function (event, req, res, ...args) {
  if ((event === "request" || event === "upgrade") && req) {
    try {
      align(req);
    } catch {
      // no bloquear la petición
    }
  }
  return original.call(this, event, req, res, ...args);
};

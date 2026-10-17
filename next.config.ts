import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La sesión y los datos cambian en cada visita. Activity (cacheComponents)
  // deja las pantallas anteriores en el DOM y estorba la navegación simple.
  cacheComponents: false,
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: { position: "top-right" },
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  // El host público llega por el proxy (trycloudflare, ngrok, etc.).
  // scripts/trust-proxy.cjs alinea Host cuando el proxy lo reescribe a una
  // dirección interna. Esta lista cubre el caso en que Origin y Host aún difieren.
  experimental: {
    serverActions: {
      allowedOrigins: [
        "*.trycloudflare.com",
        "**.trycloudflare.com",
        "*.cfargotunnel.com",
        "**.cfargotunnel.com",
        "*.ngrok.io",
        "**.ngrok.io",
        "*.ngrok-free.app",
        "**.ngrok-free.app",
        "*.ngrok.app",
        "**.ngrok.app",
        "*.ngrok.dev",
        "**.ngrok.dev",
        "*.loca.lt",
        "**.loca.lt",
        "*.localhost.run",
        "**.localhost.run",
        "*.lhr.life",
        "**.lhr.life",
        "*.serveo.net",
        "**.serveo.net",
        "*.onrender.com",
        "**.onrender.com",
      ],
    },
  },
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node",
      "./docs/legal/**/*",
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La sesión y los datos cambian en cada visita. Activity (cacheComponents)
  // deja las pantallas anteriores en el DOM y estorba la navegación simple.
  cacheComponents: false,
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: { position: "top-right" },
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
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

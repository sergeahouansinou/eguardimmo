import type { NextConfig } from "next";
import { securityHeadersForApp } from "@eguardimmo/config/next/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Le build est en lecture seule sur le serveur : le cache ISR reste en mémoire.
  experimental: { isrFlushToDisk: false },
  transpilePackages: ["@eguardimmo/ui", "@eguardimmo/tokens", "@eguardimmo/config"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  headers: securityHeadersForApp(),
};

export default nextConfig;

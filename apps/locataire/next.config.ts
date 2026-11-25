import type { NextConfig } from "next";
import { securityHeadersForApp } from "@eguardimmo/config/next/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Le build est en lecture seule sur le serveur : le cache ISR reste en mémoire.
  experimental: { isrFlushToDisk: false },
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ["@eguardimmo/ui", "@eguardimmo/tokens", "@eguardimmo/config", "@eguardimmo/shell", "@eguardimmo/messagerie"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  headers: securityHeadersForApp({ connectOrigins: [process.env.NEXT_PUBLIC_API_URL] }),
};

export default nextConfig;

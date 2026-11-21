import type { NextConfig } from "next";
import { securityHeadersForApp } from "@eguardimmo/config/next/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ["@eguardimmo/ui", "@eguardimmo/tokens", "@eguardimmo/config", "@eguardimmo/shell", "@eguardimmo/messagerie", "@eguardimmo/api"],
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

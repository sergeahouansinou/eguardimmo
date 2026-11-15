import type { NextConfig } from "next";
import { securityHeadersForAllRoutes } from "@eguardimmo/config/next/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ["@eguardimmo/ui", "@eguardimmo/tokens", "@eguardimmo/config", "@eguardimmo/shell"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  headers: securityHeadersForAllRoutes,
  redirects: () => Promise.resolve([{ source: "/", destination: "/connexion", permanent: false }]),
};

export default nextConfig;

import type { NextConfig } from "next";
import { securityHeadersForApp } from "@eguardimmo/config/next/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ["@eguardimmo/ui", "@eguardimmo/tokens", "@eguardimmo/config", "@eguardimmo/gestion", "@eguardimmo/messagerie", "@eguardimmo/shell"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  headers: securityHeadersForApp({ connectOrigins: [process.env.NEXT_PUBLIC_API_URL], frameSources: ["blob:"] }),
};

export default nextConfig;

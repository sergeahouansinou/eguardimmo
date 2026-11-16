import type { NextConfig } from "next";
import { contentSecurityPolicy, securityHeadersWithPolicy } from "@eguardimmo/config/next/security-headers";

const development = process.env.NODE_ENV === "development";

const policy = contentSecurityPolicy({
  "script-src": ["'self'", "'unsafe-inline'", ...(development ? ["'unsafe-eval'"] : [])],
  "style-src": ["'self'", "'unsafe-inline'"],
  "connect-src": ["'self'", ...(development ? ["ws:", "wss:"] : [])],
});

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
  headers: securityHeadersWithPolicy(policy),
};

export default nextConfig;

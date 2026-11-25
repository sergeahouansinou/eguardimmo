import type { NextConfig } from "next";
import { securityHeadersForApp } from "@eguardimmo/config/next/security-headers";

const appHeaders = securityHeadersForApp({ connectOrigins: [process.env.NEXT_PUBLIC_API_URL] });

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Le build est en lecture seule sur le serveur : le cache ISR reste en mémoire.
  experimental: { isrFlushToDisk: false },
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
  headers: async () => [
    ...(await appHeaders()),
    { source: "/invitation-proprietaire/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
  ],
  redirects: () => Promise.resolve([{ source: "/", destination: "/connexion", permanent: false }]),
};

export default nextConfig;

import type { MetadataRoute } from "next";
import { siteEnv } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const base = siteEnv().NEXT_PUBLIC_SITE_URL;
  return { rules: { userAgent: "*", allow: "/", disallow: "/api/" }, sitemap: `${base}/sitemap.xml`, host: base };
}

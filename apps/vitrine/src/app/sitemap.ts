import type { MetadataRoute } from "next";
import { siteEnv } from "@/lib/env";
import { SITEMAP_PATHS } from "@/lib/routes";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteEnv().NEXT_PUBLIC_SITE_URL;
  return SITEMAP_PATHS.map((path) => ({ url: path === "/" ? base : `${base}${path}` }));
}

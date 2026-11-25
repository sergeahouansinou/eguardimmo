import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/compte", "/favorites", "/listings/*/reserve"] }],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}

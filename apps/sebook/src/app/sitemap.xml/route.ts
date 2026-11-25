import { connection } from "next/server";
import { absoluteUrl, INFO_PATHS } from "@/lib/seo";
import { type SitemapEntry, sitemapXml } from "@/lib/sitemapXml";
import { fetchAllListings } from "@/marketplace/server";

const RETRY_AFTER_SECONDS = "300";

export async function GET(): Promise<Response> {
  await connection();
  const listings = await fetchAllListings();
  if (listings.status !== "found") {
    return new Response("Catalogue indisponible : plan du site non généré.", { status: 503, headers: { "Retry-After": RETRY_AFTER_SECONDS, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }
  const entries: SitemapEntry[] = [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/destinations"), changeFrequency: "daily", priority: 0.8 },
    ...listings.value.map((listing) => ({ url: absoluteUrl(`/listings/${listing.public_ref}`), changeFrequency: "weekly" as const, priority: 0.6 })),
    ...INFO_PATHS.map((path) => ({ url: absoluteUrl(path), changeFrequency: "yearly" as const, priority: 0.3 })),
  ];
  return new Response(sitemapXml(entries), { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400" } });
}

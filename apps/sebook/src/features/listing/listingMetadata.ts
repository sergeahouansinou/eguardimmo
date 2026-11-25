import type { Metadata } from "next";
import { priceLine, placeLine } from "@/marketplace/format";
import { CATEGORY_SINGULAR } from "@/marketplace/labels";
import type { Lookup } from "@/marketplace/server";
import type { ListingDetail } from "@/marketplace/schemas";

const DESCRIPTION_EXCERPT = 140;
const HIDDEN = { index: false, follow: true } as const;

export function listingPath(ref: string): string {
  return `/listings/${ref}`;
}

export function listingMetadata(result: Lookup<ListingDetail>): Metadata {
  if (result.status === "absent") return { title: "Annonce introuvable", robots: HIDDEN };
  if (result.status === "unavailable") return { title: "Annonce indisponible" };
  const listing = result.value;
  const price = priceLine(listing);
  const excerpt = listing.description.replace(/\s+/g, " ").trim().slice(0, DESCRIPTION_EXCERPT);
  const where = placeLine(listing);
  const description = [`${CATEGORY_SINGULAR[listing.category]}${where ? ` · ${where}` : ""} · ${price.amount} ${price.unit}.`, excerpt].filter((part) => part !== "").join(" ");
  const url = listingPath(listing.public_ref);
  return {
    title: listing.title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", siteName: "SeBook", locale: "fr_FR", title: listing.title, description, url },
    twitter: { card: "summary", title: listing.title, description },
  };
}

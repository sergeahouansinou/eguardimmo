import type { Metadata } from "next";
import { pageTitle } from "@/lib/seo";
import type { ListingSummary } from "@/marketplace/schemas";
import { hasActiveFilters, searchHref, EMPTY_SEARCH, type SearchState } from "@/marketplace/search";

export function placeNameFrom(search: SearchState, items: readonly ListingSummary[]): string | null {
  if (search.place === "") return null;
  return items.find((item) => item.city?.slug === search.place)?.city?.name ?? null;
}

export function destinationsTitle(search: SearchState, placeName: string | null): string {
  const base = search.scope === "short_stay" ? "Logements à réserver" : "Logements en longue durée";
  return placeName ? `${base} à ${placeName}` : base;
}

export function isIndexableSearch(search: SearchState): boolean {
  return !hasActiveFilters(search) && search.after === null && search.checkIn === "" && search.sort === "relevance";
}

export function destinationsMetadata(search: SearchState, placeName: string | null): Metadata {
  const title = destinationsTitle(search, placeName);
  const description = `${title} : annonces publiées par des agences et des propriétaires sur SeBook.`;
  return {
    title: { absolute: pageTitle(title) },
    description,
    alternates: { canonical: searchHref({ ...EMPTY_SEARCH, scope: search.scope }) },
    robots: { index: isIndexableSearch(search), follow: true },
    openGraph: { type: "website", title, description },
  };
}

import { cache } from "react";
import { EMPTY_SEARCH } from "@/marketplace/search";
import { fetchListings } from "@/marketplace/server";
import type { ListingSummary } from "@/marketplace/schemas";

export const HOME_ROW_SIZE = 12;

export type HomeListings = { status: "ready"; short: ListingSummary[]; long: ListingSummary[] } | { status: "unavailable" };

export const getHomeListings = cache(async (): Promise<HomeListings> => {
  const [short, long] = await Promise.all([
    fetchListings({ ...EMPTY_SEARCH, scope: "short_stay", sort: "recent" }),
    fetchListings({ ...EMPTY_SEARCH, scope: "long_term", sort: "recent" }),
  ]);
  if (short.status !== "found" && long.status !== "found") return { status: "unavailable" };
  return {
    status: "ready",
    short: short.status === "found" ? short.value.items.slice(0, HOME_ROW_SIZE) : [],
    long: long.status === "found" ? long.value.items.slice(0, HOME_ROW_SIZE) : [],
  };
});

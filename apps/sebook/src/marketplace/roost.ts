import { formatMoney } from "@/lib/roost-data";
import type { Listing, PricePeriod, SceneKey } from "@/lib/roost-data";
import { ALL_SCENES } from "@/lib/roost-data";
import { minorDigits } from "@/lib/money";
import { categorySchema } from "./schemas";
import type { Category, ListingSummary } from "./schemas";

export function sceneFromRef(ref: string): SceneKey {
  let hash = 0;
  for (const char of ref) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return ALL_SCENES[hash % ALL_SCENES.length] ?? "sunset";
}

export function majorUnits(minor: number, currency: string): number {
  return minor / 10 ** minorDigits(currency);
}

export function toListing(summary: ListingSummary): Listing {
  const priceValue = majorUnits(summary.price_minor, summary.currency);
  const pricePeriod: PricePeriod = summary.price_unit === "night" ? "day" : "month";
  return {
    id: summary.public_ref,
    title: summary.title,
    subtitle: [summary.neighbourhood, summary.city?.name].filter((part): part is string => Boolean(part)).join(", "),
    price: formatMoney(priceValue, summary.currency),
    priceValue,
    scene: sceneFromRef(summary.public_ref),
    pricePeriod,
    currency: summary.currency,
    kind: summary.kind,
    category: summary.category,
    city: summary.city?.name ?? null,
    neighbourhood: summary.neighbourhood,
    maxGuests: summary.capacity,
    minNights: summary.min_nights,
    hostName: summary.host?.name ?? null,
  };
}

export function categoryFromId(id: string): Category | null {
  const parsed = categorySchema.safeParse(id);
  return parsed.success ? parsed.data : null;
}

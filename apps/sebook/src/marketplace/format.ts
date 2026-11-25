import { formatMinor } from "@/lib/money";
import { CATEGORY_SINGULAR, PRICE_UNIT_LABELS, guestsLabel } from "./labels";
import type { ListingSummary } from "./schemas";

export function priceLine(listing: Pick<ListingSummary, "price_minor" | "currency" | "price_unit">): { amount: string; unit: string } {
  return { amount: formatMinor(listing.price_minor, listing.currency), unit: PRICE_UNIT_LABELS[listing.price_unit] };
}

export function placeLine(listing: Pick<ListingSummary, "city" | "neighbourhood">): string {
  return [listing.neighbourhood, listing.city?.name].filter((part): part is string => Boolean(part)).join(", ");
}

export function characteristicsLine(listing: ListingSummary): string {
  const parts = [CATEGORY_SINGULAR[listing.category]];
  if (listing.rooms !== null) parts.push(`${String(listing.rooms)} pièce${listing.rooms > 1 ? "s" : ""}`);
  if (listing.area_m2 !== null) parts.push(`${String(listing.area_m2).replace(".", ",")} m²`);
  parts.push(guestsLabel(listing.capacity));
  return parts.join(" · ");
}

export function listingHref(ref: string, stay?: { checkIn: string; checkOut: string; guests: number | null }): string {
  const params = new URLSearchParams();
  if (stay?.checkIn && stay.checkOut) {
    params.set("arrivee", stay.checkIn);
    params.set("depart", stay.checkOut);
  }
  if (stay?.guests) params.set("voyageurs", String(stay.guests));
  const query = params.toString();
  return `/listings/${ref}${query ? `?${query}` : ""}`;
}

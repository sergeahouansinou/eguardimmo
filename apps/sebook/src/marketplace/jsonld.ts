import { minorDigits } from "@/lib/money";
import { CATEGORY_SINGULAR } from "./labels";
import type { ListingDetail } from "./schemas";

export type JsonLd = Readonly<Record<string, unknown>>;

// Piège : une balise fermante dans une valeur fermerait le script ; on échappe < et les séparateurs de ligne Unicode.
export function serializeJsonLd(data: JsonLd): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(new RegExp("\u2028", "g"), "\\u2028")
    .replace(new RegExp("\u2029", "g"), "\\u2029");
}

export function websiteJsonLd(siteUrl: string): JsonLd {
  return { "@context": "https://schema.org", "@type": "WebSite", name: "SeBook", url: siteUrl, inLanguage: "fr" };
}

export function listingJsonLd(listing: ListingDetail, pageUrl: string): JsonLd {
  const price = (listing.price_minor / 10 ** minorDigits(listing.currency)).toFixed(minorDigits(listing.currency));
  return {
    "@context": "https://schema.org",
    "@type": "Accommodation",
    name: listing.title,
    description: listing.description.slice(0, 500),
    url: pageUrl,
    additionalType: CATEGORY_SINGULAR[listing.category],
    ...(listing.city
      ? {
          address: {
            "@type": "PostalAddress",
            addressLocality: listing.city.name,
            ...(listing.city.postal_code ? { postalCode: listing.city.postal_code } : {}),
          },
        }
      : {}),
    occupancy: { "@type": "QuantitativeValue", maxValue: listing.capacity },
    ...(listing.rooms !== null ? { numberOfRooms: listing.rooms } : {}),
    ...(listing.area_m2 !== null ? { floorSize: { "@type": "QuantitativeValue", value: listing.area_m2, unitCode: "MTK" } } : {}),
    offers: {
      "@type": "Offer",
      price,
      priceCurrency: listing.currency,
      url: pageUrl,
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price,
        priceCurrency: listing.currency,
        unitText: listing.price_unit === "night" ? "NIGHT" : "MONTH",
      },
    },
  };
}

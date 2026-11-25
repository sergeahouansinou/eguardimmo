import { z } from "zod";
import { CURRENCIES, currencyOf, formatAmountInput, parseAmount } from "@/lib/currency";
import type { Currency } from "@/lib/currency";
import { AMENITIES, CATEGORIES, KINDS, POLICIES } from "./schemas";
import type { Amenity, Category, Kind, Listing, ListingPayload, Policy } from "./schemas";

export const MAX_MINOR = 100_000_000;
const LINE = /[<>]|[\p{Cc}\p{Cf}]/u;
const TEXT = /[<>]|[^\P{Cc}\n]|\p{Cf}/u;
const DIGITS = /^[0-9]+$/;

export interface ListingForm {
  kind: Kind;
  category: Category;
  title: string;
  description: string;
  neighbourhood: string;
  price: string;
  currency: Currency;
  deposit: string;
  capacity: string;
  areaM2: string;
  rooms: string;
  amenities: Amenity[];
  minNights: string;
  cancellationPolicy: Policy;
}

const PLAIN = "Le texte brut uniquement : les chevrons et les caractères de contrôle sont refusés.";

const intField = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || (DIGITS.test(value) && Number(value) >= min && Number(value) <= max), `${label} : un entier entre ${String(min)} et ${String(max)}.`);

export const listingFormSchema = z
  .object({
    kind: z.enum(KINDS),
    category: z.enum(CATEGORIES),
    title: z.string().trim().min(1, "Indiquez le titre de l’annonce.").max(120, "120 caractères au maximum.").refine((value) => !LINE.test(value), PLAIN),
    description: z.string().max(4000, "4 000 caractères au maximum.").refine((value) => !TEXT.test(value), PLAIN),
    neighbourhood: z.string().trim().max(80, "80 caractères au maximum.").refine((value) => !LINE.test(value), PLAIN),
    price: z.string(),
    currency: z.enum(CURRENCIES),
    deposit: z.string(),
    capacity: intField("Capacité", 1, 50),
    areaM2: intField("Surface", 1, 5000),
    rooms: intField("Pièces", 1, 50),
    amenities: z.array(z.enum(AMENITIES)),
    minNights: intField("Durée minimale", 1, 365).refine((value) => value !== "", "Indiquez une durée minimale."),
    cancellationPolicy: z.enum(POLICIES),
  })
  .superRefine((values, ctx) => {
    const price = values.price.trim() === "" ? null : parseAmount(values.price, values.currency);
    if (values.price.trim() !== "" && (price === null || price < 1 || price > MAX_MINOR)) {
      ctx.addIssue({ code: "custom", path: ["price"], message: "Indiquez un prix supérieur à zéro, par exemple 85 ou 85,50." });
    }
    const deposit = values.deposit.trim() === "" ? null : parseAmount(values.deposit, values.currency);
    if (values.deposit.trim() !== "" && (deposit === null || deposit > MAX_MINOR)) {
      ctx.addIssue({ code: "custom", path: ["deposit"], message: "Indiquez un montant valide, par exemple 200." });
    }
  });

export function emptyListingForm(): ListingForm {
  return {
    kind: "short_stay",
    category: "apartment",
    title: "",
    description: "",
    neighbourhood: "",
    price: "",
    currency: "EUR",
    deposit: "",
    capacity: "",
    areaM2: "",
    rooms: "",
    amenities: [],
    minNights: "1",
    cancellationPolicy: "moderate",
  };
}

const text = (value: number | null): string => (value === null ? "" : String(value));

export function formFromListing(listing: Listing): ListingForm {
  const currency = currencyOf(listing.price?.currency ?? listing.deposit?.currency ?? "EUR") ?? "EUR";
  return {
    kind: listing.kind,
    category: listing.category,
    title: listing.title ?? "",
    description: listing.description ?? "",
    neighbourhood: listing.neighbourhood ?? "",
    price: listing.price === null ? "" : formatAmountInput(listing.price.amount, currency),
    currency,
    deposit: listing.deposit === null ? "" : formatAmountInput(listing.deposit.amount, currency),
    capacity: text(listing.capacity),
    areaM2: text(listing.areaM2),
    rooms: text(listing.rooms),
    amenities: [...listing.amenities],
    minNights: String(listing.minNights),
    cancellationPolicy: listing.cancellationPolicy,
  };
}

const amount = (value: string, currency: Currency): number | null => (value.trim() === "" ? null : parseAmount(value, currency));
const count = (value: string): number | null => (value.trim() === "" ? null : Number(value.trim()));
const optionalText = (value: string): string | null => (value.trim() === "" ? null : value.trim());

export function toPayload(values: ListingForm, creating: boolean): ListingPayload {
  return {
    ...(creating ? { kind: values.kind } : {}),
    category: values.category,
    title: values.title.trim(),
    description: optionalText(values.description),
    neighbourhood: optionalText(values.neighbourhood),
    priceMinor: amount(values.price, values.currency),
    currency: values.currency,
    depositMinor: amount(values.deposit, values.currency),
    capacity: count(values.capacity),
    areaM2: count(values.areaM2),
    rooms: count(values.rooms),
    amenities: AMENITIES.filter((amenity) => values.amenities.includes(amenity)),
    minNights: Number(values.minNights.trim()),
    cancellationPolicy: values.cancellationPolicy,
  };
}

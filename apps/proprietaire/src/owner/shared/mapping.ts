import type { z } from "zod";
import type { Address } from "./model";
import type { address } from "./schemas";

export function toAddress(value: z.infer<typeof address>): Address {
  return { line1: value.line1, line2: value.line2 ?? null, postalCode: value.postal_code, city: value.city, country: value.country };
}

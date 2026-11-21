import { z } from "zod";

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const isoInstant = z.string().min(1);
export const moneySchema = z.object({ amount: z.number().int(), currency: z.string().regex(/^[A-Z]{3}$/) });
export const agencyRef = z.object({ id: z.uuid(), name: z.string().nullable() });
export const mandantRef = z.object({ name: z.string().nullable() });
export const address = z.object({ line1: z.string(), line2: z.string().nullable().optional(), postal_code: z.string(), city: z.string(), country: z.string() });

export function pageOf<S extends z.ZodType>(item: S) {
  return z.object({ data: z.array(item), meta: z.object({ next_cursor: z.string().nullable() }) });
}

export function singleOf<S extends z.ZodType>(item: S) {
  return z.object({ data: item });
}

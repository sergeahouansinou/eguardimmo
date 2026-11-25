import { z } from "zod";

export const moneySchema = z.object({ amount: z.number().int(), currency: z.string().regex(/^[A-Z]{3}$/) });
export type Money = z.output<typeof moneySchema>;

export const cursorMetaSchema = z.looseObject({ next_cursor: z.string().min(1).nullish() });

export function pageSchema<S extends z.ZodType>(item: S) {
  return z
    .object({ data: z.array(item), meta: cursorMetaSchema.optional() })
    .transform((page) => ({ items: page.data, nextCursor: page.meta?.next_cursor ?? null }));
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export function listSchema<S extends z.ZodType>(item: S) {
  return z.object({ data: z.array(item) }).transform((payload) => payload.data);
}

export function dataSchema<S extends z.ZodType>(item: S) {
  return z
    .object({ data: z.unknown() })
    .transform((payload) => payload.data)
    .pipe(item);
}

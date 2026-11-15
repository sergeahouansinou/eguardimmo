import { z } from 'zod';
import { parseAmountToMinor, parseDecimal } from '../lib/amount';
import { currencySchema, factRowSchema, idSchema, isoDate, minor, yearMonth } from './common';
import type { Currency } from '../../../format/money';

export const METER_KINDS = ['electricite', 'eau_froide', 'eau_chaude', 'gaz'] as const;
export const meterKindSchema = z.enum(METER_KINDS);
export type MeterKind = z.infer<typeof meterKindSchema>;

export const REASONS = ['en_cours_de_bail', 'entree', 'sortie'] as const;
export const reasonSchema = z.enum(REASONS);
export type Reason = z.infer<typeof reasonSchema>;

export const unitSchema = z.enum(['kWh', 'm³']);

export const meterSchema = z.object({
  id: idSchema,
  lotId: idSchema,
  kind: meterKindSchema,
  ref: z.string().min(1),
  unit: unitSchema,
  details: z.array(factRowSchema),
  series: z.array(z.object({ month: yearMonth, value: z.number().nonnegative() })),
});
export type Meter = z.infer<typeof meterSchema>;

export const readingSchema = z.object({
  id: idSchema,
  meterId: idSchema,
  lotId: idSchema,
  lotName: z.string().min(1),
  kind: meterKindSchema,
  meterRef: z.string().min(1),
  unit: unitSchema,
  tenant: z.string().nullable(),
  reason: reasonSchema,
  date: isoDate,
  index: z.number().nonnegative(),
  delta: z.number().nullable(),
  cost: minor.nullable(),
  origin: z.string().min(1),
  enteredBy: z.string().min(1),
  hasPhoto: z.boolean(),
  archived: z.boolean(),
});
export type Reading = z.infer<typeof readingSchema>;

export const readingsSchema = z.object({
  currency: currencySchema,
  meters: z.array(meterSchema),
  items: z.array(readingSchema),
});
export type ReadingsData = z.infer<typeof readingsSchema>;

export const readingInputSchema = z.object({
  meterId: idSchema,
  date: isoDate,
  index: z.number().nonnegative(),
  reason: reasonSchema,
  origin: z.string().min(1),
  hasPhoto: z.boolean(),
});
export type ReadingInput = z.infer<typeof readingInputSchema>;

const required = 'Champ requis';

export const readingFormSchema = z.object({
  meterId: z.string().trim().min(1, required),
  date: z.string().trim().min(1, required).pipe(z.iso.date('Date invalide (AAAA-MM-JJ)')),
  index: z.string().trim().min(1, required).transform((text, context) => {
    const value = parseDecimal(text);
    if (value === null) {
      context.addIssue({ code: 'custom', message: 'Index invalide' });
      return z.NEVER;
    }
    return value;
  }),
  reason: reasonSchema,
  origin: z.string().trim().min(1, required),
});

export const inventaireSchema = z.object({
  id: idSchema,
  ref: z.string().min(1),
  lotId: idSchema,
  lotName: z.string().min(1),
  immeubleName: z.string().min(1),
  tenant: z.string().nullable(),
  value: minor,
  createdOn: isoDate,
  template: z.string().min(1),
  signatureSentOn: isoDate.nullable(),
  archived: z.boolean(),
});
export type Inventaire = z.infer<typeof inventaireSchema>;

export const inventairesSchema = z.object({
  currency: currencySchema,
  templates: z.array(z.string().min(1)),
  items: z.array(inventaireSchema),
});
export type InventairesData = z.infer<typeof inventairesSchema>;

export interface InventaireInput {
  lotId: string;
  template: string;
  tenant: string | null;
  value: number;
}

export function inventaireFormSchema(currency: Currency) {
  return z.object({
    lotId: z.string().trim().min(1, required),
    template: z.string().trim().min(1, required),
    tenant: z.string().trim(),
    value: z.string().trim().min(1, required).transform((text, context) => {
      const value = parseAmountToMinor(text, currency);
      if (value === null) {
        context.addIssue({ code: 'custom', message: 'Montant invalide' });
        return z.NEVER;
      }
      return value;
    }),
  });
}

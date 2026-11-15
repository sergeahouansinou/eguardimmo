import { z } from 'zod';
import { badgeSchema, count, currencySchema, factRowSchema, idSchema, isoDate, minor, photoSchema } from './common';

export const REPARTITIONS = ['tantiemes', 'surface'] as const;
export const repartitionSchema = z.enum(REPARTITIONS);
export type Repartition = z.infer<typeof repartitionSchema>;

export const immeubleRowSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  address: z.string().min(1),
  postalCode: z.string().min(1),
  city: z.string().min(1),
  country: z.string().min(1),
  lots: count,
  totalArea: z.number().nonnegative(),
  repartition: repartitionSchema,
  copropriete: z.boolean(),
  archived: z.boolean(),
});
export type ImmeubleRow = z.infer<typeof immeubleRowSchema>;

export const immeublesSchema = z.object({ items: z.array(immeubleRowSchema) });
export type ImmeublesData = z.infer<typeof immeublesSchema>;

export const immeubleValuesSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  postalCode: z.string().min(1),
  city: z.string().min(1),
  country: z.string().min(1),
  repartition: repartitionSchema,
  photoNames: z.array(z.string()),
});
export type ImmeubleValues = z.infer<typeof immeubleValuesSchema>;

export const immeubleDetailSchema = z
  .object({
    currency: currencySchema,
    immeuble: immeubleRowSchema,
    subtitle: z.string().min(1),
    badges: z.array(badgeSchema),
    photoCount: count,
    photos: z.array(photoSchema),
    facts: z.array(z.object({ id: idSchema, label: z.string().min(1), value: z.string() })),
    tantiemes: z.object({ sum: count, total: count }),
    totalLots: count.nullable(),
    counts: z.object({ lots: count, equipements: count, documents: count, interventions: count }),
    coproSummary: z.array(factRowSchema),
    keys: z.array(z.object({ id: idSchema, label: z.string().min(1), detail: z.string(), pill: badgeSchema.nullable() })),
    values: immeubleValuesSchema,
  })
  .nullable();
export type ImmeubleDetail = NonNullable<z.infer<typeof immeubleDetailSchema>>;

export const chargesSchema = z.object({
  currency: currencySchema,
  year: z.number().int(),
  sharePerMille: count,
  fundPercent: z.number(),
  lines: z.array(
    z.object({
      id: idSchema,
      label: z.string().min(1),
      key: z.string().min(1),
      share: minor,
      recoverablePercent: z.number().min(0).max(100),
    }),
  ),
  keys: z.array(z.object({ id: idSchema, label: z.string().min(1), detail: z.string(), pill: badgeSchema.nullable() })),
  regularisation: z.array(
    z.object({
      lotId: idSchema,
      lotName: z.string().min(1),
      tenant: z.string().nullable(),
      tantiemes: count,
      provisions: minor,
      recoverable: minor,
    }),
  ),
});
export type ChargesData = z.infer<typeof chargesSchema>;

export const coproSchema = z.object({
  currency: currencySchema,
  year: z.number().int(),
  meetings: z.array(
    z.object({
      id: idSchema,
      date: isoDate,
      type: z.string().min(1),
      decisions: z.string().min(1),
      vote: z.string().nullable(),
      held: z.boolean(),
    }),
  ),
  syndic: z.array(factRowSchema),
  plan: z.object({
    adoptedOn: isoDate,
    years: count,
    items: z.array(
      z.object({
        id: idSchema,
        label: z.string().min(1),
        year: z.number().int(),
        share: minor,
        financing: z.string().min(1),
        status: badgeSchema,
      }),
    ),
  }),
  calls: z.array(z.object({ id: idSchema, label: z.string().min(1), amount: minor, paid: z.boolean() })),
  fundBalance: minor,
  obligations: z.array(z.object({ id: idSchema, label: z.string().min(1), detail: z.string(), pill: badgeSchema })),
});
export type CoproData = z.infer<typeof coproSchema>;

export const immeubleIntervSchema = z.object({
  currency: currencySchema,
  year: z.number().int(),
  averageCloseDays: count.nullable(),
  items: z.array(
    z.object({
      id: idSchema,
      date: isoDate,
      title: z.string().min(1),
      place: z.string().min(1),
      provider: z.string().min(1),
      paidBy: z.string().min(1),
      cost: minor.nullable(),
      costNote: z.string().nullable(),
      status: badgeSchema,
    }),
  ),
  claims: z.array(z.object({ id: idSchema, title: z.string().min(1), detail: z.string(), pill: badgeSchema, warn: z.boolean() })),
  providers: z.array(z.object({ id: idSchema, name: z.string().min(1), detail: z.string(), trade: z.string().min(1) })),
});
export type ImmeubleIntervData = z.infer<typeof immeubleIntervSchema>;

const required = 'Champ requis';
const trimmed = z.string().trim();

export const immeubleFormSchema = z.object({
  name: trimmed.min(1, required).max(80, '80 caractères au maximum'),
  address: trimmed.min(1, required),
  postalCode: trimmed.min(1, required).max(10, '10 caractères au maximum'),
  city: trimmed.min(1, required),
  country: trimmed.min(1, required),
  repartition: repartitionSchema,
  photoNames: z.array(z.string()),
});

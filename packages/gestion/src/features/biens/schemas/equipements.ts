import { z } from 'zod';
import { parseAmountToMinor } from '../lib/amount';
import { badgeSchema, count, currencySchema, factRowSchema, idSchema, isoDate, minor, photoSchema } from './common';
import type { Currency } from '../../../format/money';

export const FAMILIES = [
  'climatisation',
  'chauffage',
  'electromenager',
  'cuisine',
  'ventilation',
  'securite',
  'acces',
  'plomberie',
] as const;
export const familySchema = z.enum(FAMILIES);
export type Family = z.infer<typeof familySchema>;

export const equipementStatusSchema = z.enum(['en_service', 'hors_service']);
export const chargedToSchema = z.enum(['bailleur', 'locataire', 'copropriete']);
export type ChargedTo = z.infer<typeof chargedToSchema>;

export const equipementRowSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  detail: z.string(),
  family: familySchema,
  lotId: idSchema.nullable(),
  immeubleId: idSchema.nullable(),
  placeName: z.string().min(1),
  room: z.string().nullable(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  purchasedOn: isoDate.nullable(),
  price: minor.nullable(),
  warrantyEndsOn: isoDate.nullable(),
  warrantyNote: z.string().nullable(),
  nextMaintenanceOn: isoDate.nullable(),
  maintenanceNote: z.string().nullable(),
  chargedTo: chargedToSchema,
  status: equipementStatusSchema,
  provider: z.string().nullable(),
  lastVisitOn: isoDate.nullable(),
  obligation: z.string().nullable(),
  contractYearly: minor.nullable(),
  archived: z.boolean(),
});
export type EquipementRow = z.infer<typeof equipementRowSchema>;

export const equipementsSchema = z.object({ currency: currencySchema, asOf: isoDate, items: z.array(equipementRowSchema) });
export type EquipementsData = z.infer<typeof equipementsSchema>;

export const equipementValuesSchema = z.object({
  name: z.string().min(1),
  detail: z.string(),
  family: familySchema,
  lotId: idSchema.nullable(),
  immeubleId: idSchema.nullable(),
  room: z.string(),
  brand: z.string(),
  model: z.string(),
  purchasedOn: isoDate.nullable(),
  price: minor.nullable(),
  warrantyEndsOn: isoDate.nullable(),
  chargedTo: chargedToSchema,
  photoNames: z.array(z.string()),
});
export type EquipementValues = z.infer<typeof equipementValuesSchema>;

const logEntrySchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  date: isoDate,
  detail: z.string(),
  done: z.boolean(),
  cost: minor.nullable(),
});
export type LogEntry = z.infer<typeof logEntrySchema>;

export const equipementDetailSchema = z
  .object({
    currency: currencySchema,
    asOf: isoDate,
    equipement: equipementRowSchema,
    subtitle: z.string().min(1),
    badges: z.array(badgeSchema),
    photoCount: count,
    photos: z.array(photoSchema),
    identification: z.array(factRowSchema),
    warranty: z.object({
      coverage: z.string().min(1),
      months: count,
      startsOn: isoDate.nullable(),
      endsOn: isoDate.nullable(),
    }),
    maintenanceRows: z.array(factRowSchema),
    cost: z.object({ total: minor, maintenance: minor, lifetimeYears: count.nullable(), replacementYear: z.number().int().nullable() }),
    plan: z.array(
      z.object({
        id: idSchema,
        label: z.string().min(1),
        doneBy: z.string().min(1),
        periodicity: z.string().min(1),
        lastOn: isoDate.nullable(),
        nextOn: isoDate.nullable(),
        reminder: z.string(),
        status: badgeSchema,
      }),
    ),
    log: z.array(logEntrySchema),
    warrantyDocs: z.array(factRowSchema),
    reasons: z.array(z.object({ id: idSchema, title: z.string().min(1), detail: z.string() })),
    values: equipementValuesSchema,
  })
  .nullable();
export type EquipementDetail = NonNullable<z.infer<typeof equipementDetailSchema>>;

const intervItemSchema = z.object({
  id: idSchema,
  date: isoDate,
  title: z.string().min(1),
  equipment: z.string().min(1),
  provider: z.string().min(1),
  cost: minor.nullable(),
  costNote: z.string().nullable(),
  status: badgeSchema,
});

export const equipementIntervSchema = z.object({
  currency: currencySchema,
  own: z.array(intervItemSchema),
  placeLabel: z.string().min(1),
  breakdown: z.array(z.object({ id: idSchema, title: z.string().min(1), detail: z.string(), pill: badgeSchema.nullable(), ok: z.boolean() })),
  others: z.array(intervItemSchema),
});
export type EquipementIntervData = z.infer<typeof equipementIntervSchema>;

const required = 'Champ requis';
const trimmed = z.string().trim();

function amountField(currency: Currency) {
  return trimmed.transform((text, context) => {
    if (text === '') return null;
    const value = parseAmountToMinor(text, currency);
    if (value === null) {
      context.addIssue({ code: 'custom', message: 'Montant invalide' });
      return z.NEVER;
    }
    return value;
  });
}

const optionalDate = trimmed.transform((text, context) => {
  if (text === '') return null;
  if (!z.iso.date().safeParse(text).success) {
    context.addIssue({ code: 'custom', message: 'Date invalide (AAAA-MM-JJ)' });
    return z.NEVER;
  }
  return text;
});

export function equipementFormSchema(currency: Currency) {
  return z
    .object({
      name: trimmed.min(1, required).max(80, '80 caractères au maximum'),
      detail: trimmed.max(60, '60 caractères au maximum'),
      family: familySchema,
      place: trimmed.min(1, required),
      room: trimmed,
      brand: trimmed,
      model: trimmed,
      purchasedOn: optionalDate,
      price: amountField(currency),
      warrantyEndsOn: optionalDate,
      chargedTo: chargedToSchema,
      photoNames: z.array(z.string()),
    })
    .superRefine((value, context) => {
      if (value.purchasedOn && value.warrantyEndsOn && value.warrantyEndsOn < value.purchasedOn) {
        context.addIssue({ code: 'custom', path: ['warrantyEndsOn'], message: 'La garantie finit avant l’achat' });
      }
    });
}

export function logEntryFormSchema(currency: Currency) {
  return z.object({
    title: trimmed.min(1, required).max(100, '100 caractères au maximum'),
    date: z.iso.date('Date invalide (AAAA-MM-JJ)'),
    detail: trimmed.max(160, '160 caractères au maximum'),
    cost: amountField(currency),
  });
}

export function operationFormSchema(asOf: string) {
  return z.object({
    label: trimmed.min(1, required).max(100, '100 caractères au maximum'),
    doneBy: trimmed.max(60, '60 caractères au maximum'),
    periodicityMonths: trimmed.transform((text, context) => {
      const value = /^\d{1,3}$/.test(text) ? Number(text) : Number.NaN;
      if (!Number.isInteger(value) || value < 1 || value > 240) {
        context.addIssue({ code: 'custom', message: 'Entre 1 et 240 mois' });
        return z.NEVER;
      }
      return value;
    }),
    lastOn: optionalDate.refine((value) => value === null || value <= asOf, 'La date ne peut pas être dans le futur'),
  });
}

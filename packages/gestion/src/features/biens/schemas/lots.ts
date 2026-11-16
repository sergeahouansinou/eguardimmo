import { z } from 'zod';
import { parseAmountToMinor, parseDecimal } from '../lib/amount';
import {
  badgeSchema,
  count,
  currencySchema,
  documentsSchema,
  factRowSchema,
  idSchema,
  isoDate,
  letterSchema,
  minor,
  personRefSchema,
  photoSchema,
} from './common';
import type { Currency } from '../../../format/money';

export const LOT_TYPES = ['appartement', 'studio', 'maison', 'parking', 'bureau', 'garage', 'cave', 'local', 'terrain', 'autre'] as const;
export const lotTypeSchema = z.enum(LOT_TYPES);
export type LotType = z.infer<typeof lotTypeSchema>;

export const lotStatusSchema = z.enum(['retard', 'a_jour', 'preavis', 'a_louer', 'travaux']);
export type LotStatus = z.infer<typeof lotStatusSchema>;

export const listingSchema = z.enum(['en_ligne', 'hors_ligne']);
export type Listing = z.infer<typeof listingSchema>;

export const HEATINGS = ['electrique', 'gaz', 'pompe_a_chaleur'] as const;
export const heatingSchema = z.enum(HEATINGS);
export type Heating = z.infer<typeof heatingSchema>;

export const lotRowSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  immeubleId: idSchema,
  immeubleName: z.string().min(1),
  type: lotTypeSchema,
  surface: z.number().positive().nullable(),
  rooms: count.nullable(),
  floor: z.string().nullable(),
  tenant: personRefSchema.nullable(),
  rent: minor.nullable(),
  listing: listingSchema.nullable(),
  status: lotStatusSchema.nullable(),
  tantiemes: count.nullable(),
  elevatorShares: count.nullable(),
  leaseEnd: isoDate.nullable(),
  leaseNote: z.string().nullable(),
  archived: z.boolean(),
});
export type LotRow = z.infer<typeof lotRowSchema>;

export const lotsSchema = z.object({ currency: currencySchema, items: z.array(lotRowSchema) });
export type LotsData = z.infer<typeof lotsSchema>;

export const AMENITIES = [
  { id: 'cuisine_equipee', label: 'Cuisine équipée' },
  { id: 'balcon', label: 'Balcon' },
  { id: 'cave', label: 'Cave' },
  { id: 'lave_linge', label: 'Lave-linge' },
  { id: 'climatisation', label: 'Climatisation' },
  { id: 'piscine', label: 'Piscine' },
] as const;
export type AmenityId = (typeof AMENITIES)[number]['id'];

export const lotValuesSchema = z.object({
  name: z.string().min(1),
  type: lotTypeSchema,
  immeubleId: idSchema,
  address: z.string().min(1),
  complement: z.string(),
  postalCode: z.string().min(1),
  city: z.string().min(1),
  surface: z.number().positive().nullable(),
  rooms: count.nullable(),
  floor: z.string(),
  elevator: z.boolean(),
  heating: heatingSchema,
  amenities: z.array(z.string()),
  rent: minor.nullable(),
  charges: minor.nullable(),
  photoNames: z.array(z.string()),
});
export type LotValues = z.infer<typeof lotValuesSchema>;

export const caracSectionSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  editable: z.boolean(),
  rows: z.array(factRowSchema),
  subSections: z.array(z.object({ title: z.string().min(1), rows: z.array(factRowSchema) })),
});

export const amenityGroupSchema = z.object({ title: z.string().min(1), items: z.array(z.string().min(1)) });

export const lotDetailSchema = z
  .object({
    currency: currencySchema,
    lot: lotRowSchema,
    subtitle: z.string().min(1),
    badges: z.array(badgeSchema),
    photoCount: count,
    photos: z.array(photoSchema),
    brief: z.object({
      habitableArea: z.number().positive().nullable(),
      carrezArea: z.number().positive().nullable(),
      rooms: z.string().min(1),
      floor: z.string().min(1),
      builtYear: z.number().int().nullable(),
      rental: z.string().min(1).nullable(),
      dpe: z.object({ energy: letterSchema, ghg: letterSchema }).nullable(),
      rentCc: minor.nullable(),
    }),
    counts: z.object({ diagnostics: count.nullable(), locations: count.nullable(), equipements: count.nullable(), documents: count.nullable() }),
    caracteristiques: z.array(caracSectionSchema),
    amenityGroups: z.array(amenityGroupSchema),
    values: lotValuesSchema,
  })
  .nullable();
export type LotDetail = NonNullable<z.infer<typeof lotDetailSchema>>;

export const periodSchema = z.object({
  id: idSchema,
  kind: z.enum(['bail', 'vacance']),
  startDate: isoDate,
  endDate: isoDate.nullable(),
  occupant: personRefSchema.nullable(),
  leaseType: z.string().nullable(),
  note: z.string().nullable(),
  status: z.enum(['en_cours', 'preavis', 'termine']).nullable(),
  noticeEndsOn: isoDate.nullable(),
  entryRent: minor.nullable(),
  lastRent: minor.nullable(),
  deposit: minor.nullable(),
  exitNote: z.string().nullable(),
});
export type Period = z.infer<typeof periodSchema>;

export const occupationSchema = z.object({
  currency: currencySchema,
  asOf: isoDate,
  acquisitionDate: isoDate,
  periods: z.array(periodSchema),
  rentSteps: z.array(z.object({ year: z.number().int(), rent: minor, event: z.string().nullable() })),
  inspections: z.array(
    z.object({
      id: idSchema,
      title: z.string().min(1),
      date: isoDate,
      detail: z.string(),
      signed: z.boolean(),
      current: z.boolean(),
    }),
  ),
});
export type OccupationData = z.infer<typeof occupationSchema>;

export const leaseSchema = z
  .object({
    currency: currencySchema,
    tenant: personRefSchema,
    leaseHref: z.string().regex(/^\/[\w\-/]*$/),
    kind: z.string().min(1),
    startDate: isoDate,
    endDate: isoDate.nullable(),
    rentExcl: minor,
    provisions: minor,
    deposit: minor,
    nextRevision: isoDate.nullable(),
    balance: minor.nullable(),
  })
  .nullable();
export type LeaseData = NonNullable<z.infer<typeof leaseSchema>>;

export const diagnosticStatusSchema = z.enum(['valide', 'a_refaire', 'expire', 'sans_objet']);
export type DiagnosticStatus = z.infer<typeof diagnosticStatusSchema>;

export const diagnosticSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  doneOn: isoDate.nullable(),
  validity: z.string().min(1),
  expiresOn: isoDate.nullable(),
  expiresNote: z.string().nullable(),
  result: z.string(),
  ratings: z.object({ energy: letterSchema, ghg: letterSchema }).nullable(),
  status: diagnosticStatusSchema,
  hasFile: z.boolean(),
  orderedOn: isoDate.nullable(),
});
export type Diagnostic = z.infer<typeof diagnosticSchema>;

export const diagnosticsSchema = z.object({
  asOf: isoDate,
  items: z.array(diagnosticSchema),
  dpe: z
    .object({
      date: isoDate,
      energy: z.object({ letter: letterSchema, value: z.number(), unit: z.string() }),
      ghg: z.object({ letter: letterSchema, value: z.number(), unit: z.string() }),
    })
    .nullable(),
});
export type DiagnosticsData = z.infer<typeof diagnosticsSchema>;

export const lotFinancesSchema = z.object({
  currency: currencySchema,
  purchasePrice: minor.nullable(),
  purchaseYear: z.number().int().nullable(),
  fees: minor.nullable(),
  estimatedValue: minor.nullable(),
  estimatedYear: z.number().int().nullable(),
  remainingCapital: minor.nullable(),
  loanPayment: z.string().nullable(),
  balanceDue: minor,
  balanceNote: z.string().nullable(),
  months: z.array(
    z.object({
      month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
      called: minor,
      collected: minor,
      expenses: minor,
      expenseNote: z.string().nullable(),
    }),
  ),
  operations: z.array(
    z.object({
      id: idSchema,
      date: isoDate,
      label: z.string().min(1),
      category: z.string().min(1),
      amount: minor.nullable(),
      status: badgeSchema,
    }),
  ),
});
export type LotFinances = z.infer<typeof lotFinancesSchema>;

export const lotSuiviSchema = z.object({
  interventions: z.array(
    z.object({ id: idSchema, title: z.string().min(1), detail: z.string(), status: badgeSchema }),
  ),
});
export type LotSuivi = z.infer<typeof lotSuiviSchema>;

export const lotDocumentsSchema = documentsSchema;

export const lotImportRowSchema = z.object({
  name: z.string().min(1),
  immeubleName: z.string().min(1),
  type: lotTypeSchema,
  surface: z.number().positive(),
  rooms: count.nullable(),
  rent: minor.nullable(),
});
export type LotImportRow = z.infer<typeof lotImportRowSchema>;

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

export const SURFACELESS_TYPES: readonly LotType[] = ['parking', 'garage', 'cave', 'terrain', 'autre'];

function optionalDecimalField(message: string) {
  return trimmed.transform((text, context) => {
    if (text === '') return null;
    const value = parseDecimal(text);
    if (value === null || value <= 0) {
      context.addIssue({ code: 'custom', message });
      return z.NEVER;
    }
    return value;
  });
}

export function lotFormSchema(currency: Currency) {
  return z
    .object({
      name: trimmed.min(1, required).max(80, '80 caractères au maximum'),
      type: lotTypeSchema,
      immeubleId: trimmed.min(1, required),
      address: trimmed.min(1, required),
      complement: trimmed,
      postalCode: trimmed.min(1, required).max(10, '10 caractères au maximum'),
      city: trimmed.min(1, required),
      surface: optionalDecimalField('Surface invalide'),
      rooms: trimmed.transform((text, context) => {
        if (text === '') return null;
        if (!/^\d{1,2}$/.test(text)) {
          context.addIssue({ code: 'custom', message: 'Nombre entier attendu' });
          return z.NEVER;
        }
        return Number(text);
      }),
      floor: trimmed.max(20, '20 caractères au maximum'),
      elevator: z.boolean(),
      heating: heatingSchema,
      amenities: z.array(z.string()),
      rent: amountField(currency),
      charges: amountField(currency),
      photoNames: z.array(z.string()),
    })
    .superRefine((value, context) => {
      if (value.surface === null && !SURFACELESS_TYPES.includes(value.type)) context.addIssue({ code: 'custom', path: ['surface'], message: required });
    });
}

export const VALIDITIES = ['6 mois', '1 an', '3 ans', '6 ans', '10 ans', 'Illimitée'] as const;

export const diagnosticFormSchema = z.object({
  label: trimmed.min(1, required).max(80, '80 caractères au maximum'),
  doneOn: trimmed.min(1, required).pipe(z.iso.date('Date invalide (AAAA-MM-JJ)')),
  validity: z.enum(VALIDITIES),
  result: trimmed.max(120, '120 caractères au maximum'),
});

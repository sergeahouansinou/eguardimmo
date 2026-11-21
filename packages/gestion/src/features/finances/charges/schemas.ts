import { z } from 'zod';
import { minorDigits } from '../../../format/money';
import type { Currency } from '../../../format/money';
import { EXPENSE_KINDS, EXPENSE_SETTLEMENTS, KEY_KINDS, PLAN_BASES } from './model';
import type { ExpenseSettlement } from './model';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const WHOLE_PATTERN = /^\d+$/;
const DECIMAL_PATTERNS: Record<number, RegExp> = { 2: /^\d+([.,]\d{1,2})?$/ };
const QUANTITY_PATTERN = /^\d+([.,]\d{1,3})?$/;
const MIN_DATE = '2000-01-01';
const MAX_MINOR = 100_000_000_000;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const FILE_MIMES = ['application/pdf', 'image/jpeg', 'image/png'] as const;

export function parseMinor(text: string, currency: Currency): number | null {
  const digits = minorDigits(currency);
  const value = text.trim();
  const pattern = digits === 0 ? WHOLE_PATTERN : DECIMAL_PATTERNS[digits];
  if (!pattern?.test(value)) return null;
  const [whole = '0', decimals = ''] = value.replace(',', '.').split('.');
  const minor = Number(whole) * 10 ** digits + Number(decimals.padEnd(digits, '0'));
  return Number.isSafeInteger(minor) ? minor : null;
}

export function parseQuantityMilli(text: string): number | null {
  const value = text.trim();
  if (!QUANTITY_PATTERN.test(value)) return null;
  const [whole = '0', decimals = ''] = value.replace(',', '.').split('.');
  const milli = Number(whole) * 1000 + Number(decimals.padEnd(3, '0'));
  return Number.isSafeInteger(milli) && milli >= 1 ? milli : null;
}

export function minorToInput(minor: number, currency: Currency): string {
  const digits = minorDigits(currency);
  if (digits === 0) return String(minor);
  const factor = 10 ** digits;
  return `${String(Math.trunc(minor / factor))},${String(minor % factor).padStart(digits, '0')}`;
}

const date = (label: string) => z.string().regex(DATE_PATTERN, `${label} : indiquez une date valide.`).refine((value) => value >= MIN_DATE, `${label} : la date est trop ancienne.`);
const optionalDate = z.string().refine((value) => value === '' || (DATE_PATTERN.test(value) && value >= MIN_DATE), 'Indiquez une date valide.');
const moneyField = (currency: Currency, label: string, options: { min: number }) =>
  z
    .string()
    .trim()
    .transform((text, context) => {
      const minor = parseMinor(text, currency);
      if (minor === null || minor < options.min || minor > MAX_MINOR) {
        context.addIssue({ code: 'custom', message: `${label} : ${minorDigits(currency) === 0 ? 'nombre entier de francs, ex. 450000' : 'montant valide, ex. 850 ou 850,50'}.` });
        return z.NEVER;
      }
      return minor;
    });

export const reasonSchema = z.object({ reason: z.string().trim().min(3, 'Indiquez un motif de 3 à 255 caractères.').max(255, 'Le motif ne peut pas dépasser 255 caractères.') });
export type ReasonValues = z.input<typeof reasonSchema>;

export const planSchema = reasonSchema.extend({ basis: z.enum(PLAN_BASES, 'Choisissez le fondement de la demande.') });
export type PlanValues = z.input<typeof planSchema>;

const documentField = z
  .instanceof(File)
  .nullable()
  .superRefine((file, context) => {
    if (file === null) return;
    if (file.size > MAX_FILE_BYTES) context.addIssue({ code: 'custom', message: 'La pièce dépasse 10 Mo.' });
    if (!FILE_MIMES.some((mime) => mime === file.type)) context.addIssue({ code: 'custom', message: 'La pièce doit être un PDF, un JPG ou un PNG.' });
  });

export interface ExpenseSchemaContext {
  currency: Currency;
  today: string;
}

const NEEDS_DOCUMENT: readonly ExpenseSettlement[] = ['trust', 'paid_by_owner', 'none'];

export function expenseFormSchema({ currency, today }: ExpenseSchemaContext) {
  return z
    .object({
      propertyId: z.string().min(1, 'Choisissez le bien.'),
      unitId: z.string(),
      kind: z.enum(EXPENSE_KINDS),
      categoryTermId: z.string().min(1, 'Choisissez la catégorie.'),
      payeeLabel: z.string().trim().max(120, 'Le fournisseur ne peut pas dépasser 120 caractères.'),
      reference: z.string().trim().max(64, 'La référence ne peut pas dépasser 64 caractères.'),
      documentOn: date('Date de la pièce'),
      serviceFrom: date('Début du service'),
      serviceTo: date('Fin du service'),
      totalGross: moneyField(currency, 'Montant TTC', { min: 1 }),
      taxAmount: moneyField(currency, 'TVA', { min: 0 }),
      recoverableAmount: moneyField(currency, 'Part récupérable', { min: 0 }),
      recoverableRubric: z.string(),
      settlement: z.enum(EXPENSE_SETTLEMENTS, 'Choisissez le mode de règlement.'),
      paidOn: optionalDate,
      document: documentField,
    })
    .superRefine((value, context) => {
      const issue = (path: string, message: string) => { context.addIssue({ code: 'custom', path: [path], message }); };
      if (value.documentOn > today) issue('documentOn', 'La date de la pièce ne peut pas être dans le futur.');
      if (value.serviceTo <= value.serviceFrom) issue('serviceTo', 'La fin du service doit suivre son début (jour exclu).');
      if (value.taxAmount > value.totalGross) issue('taxAmount', 'La TVA ne peut pas dépasser le montant TTC.');
      if (value.recoverableAmount > value.totalGross) issue('recoverableAmount', 'La part récupérable ne peut pas dépasser le montant TTC.');
      if (value.recoverableAmount > 0 && value.recoverableRubric === '') issue('recoverableRubric', 'Choisissez la rubrique récupérable.');
      if (value.paidOn !== '' && (value.paidOn > today || value.paidOn < value.documentOn)) issue('paidOn', 'La date de paiement suit la pièce et n’est pas dans le futur.');
      if (value.kind === 'co_ownership_statement' && (value.unitId === '' || value.settlement !== 'none')) issue('unitId', 'Un relevé du syndic se saisit pour un lot, sans mode de règlement.');
      if (value.document === null && (value.recoverableAmount > 0 || NEEDS_DOCUMENT.includes(value.settlement))) issue('document', 'La pièce justificative est obligatoire pour ce mode de règlement ou cette part récupérable.');
    });
}
export type ExpenseFormValues = z.input<ReturnType<typeof expenseFormSchema>>;
export type ExpenseFormOutput = z.output<ReturnType<typeof expenseFormSchema>>;

export const exportSchema = z
  .object({ from: date('Du'), to: date('Au'), propertyId: z.string() })
  .refine((value) => value.to > value.from, { path: ['to'], message: 'La fin de la période doit suivre son début.' });
export type ExportValues = z.input<typeof exportSchema>;

const weightField = z.string().trim().refine((value) => value === '' || WHOLE_PATTERN.test(value), 'Un entier positif ou vide.');

export const keyFormSchema = z
  .object({
    label: z.string().trim().min(2, 'Le libellé compte 2 à 120 caractères.').max(120, 'Le libellé compte 2 à 120 caractères.'),
    kind: z.enum(KEY_KINDS),
    validFrom: date('Date d’effet'),
    weights: z.array(z.object({ unitId: z.string(), weight: weightField })),
  })
  .superRefine((value, context) => {
    if (value.kind !== 'tantiemes' && value.kind !== 'custom') return;
    const total = value.weights.reduce((sum, row) => sum + (row.weight === '' ? 0 : Number(row.weight)), 0);
    if (total <= 0) context.addIssue({ code: 'custom', path: ['weights'], message: 'Saisissez au moins un poids supérieur à zéro.' });
  });
export type KeyFormValues = z.input<typeof keyFormSchema>;

export const versionFormSchema = z.object({ validFrom: date('Date d’effet'), weights: keyFormSchema.shape.weights });
export type VersionFormValues = z.input<typeof versionFormSchema>;

export const exerciseHeaderSchema = z
  .object({ propertyId: z.string().min(1, 'Choisissez le bien.'), periodStart: date('Début'), periodEnd: date('Fin') })
  .superRefine((value, context) => {
    if (value.periodEnd <= value.periodStart) context.addIssue({ code: 'custom', path: ['periodEnd'], message: 'La fin (exclue) doit suivre le début.' });
  });
export type ExerciseHeaderValues = z.input<typeof exerciseHeaderSchema>;

export function itemsFormSchema(currency: Currency) {
  const source = z.object({
    id: z.string().min(1, 'Choisissez la dépense source.'),
    amount: z.string().trim().transform((text, context) => {
      if (text === '') return null;
      const minor = parseMinor(text, currency);
      if (minor === null || minor < 1) {
        context.addIssue({ code: 'custom', message: 'Montant retenu invalide, ou laissez vide pour la part proposée.' });
        return z.NEVER;
      }
      return minor;
    }),
  });
  const consumption = z.object({
    unitId: z.string(),
    quantity: z.string().trim().transform((text, context) => {
      if (text === '') return null;
      const milli = parseQuantityMilli(text);
      if (milli === null) {
        context.addIssue({ code: 'custom', message: 'Quantité invalide, ex. 12,5.' });
        return z.NEVER;
      }
      return milli;
    }),
  });
  const item = z
    .object({
      label: z.string().trim().min(1, 'Donnez un libellé au poste.').max(120, 'Le libellé ne peut pas dépasser 120 caractères.'),
      rubric: z.string().min(1, 'Choisissez la rubrique.'),
      target: z.string().min(1, 'Choisissez la clé de répartition ou le lot.'),
      sources: z.array(source).min(1, 'Ajoutez au moins une dépense source.').max(100, 'Cent sources au plus par poste.'),
      consumptions: z.array(consumption),
    });
  return z.object({ items: z.array(item).max(100, 'Cent postes au plus.') });
}
export type ItemsFormValues = z.input<ReturnType<typeof itemsFormSchema>>;
export type ItemsFormOutput = z.output<ReturnType<typeof itemsFormSchema>>;

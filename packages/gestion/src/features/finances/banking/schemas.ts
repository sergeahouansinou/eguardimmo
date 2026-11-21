import { z } from 'zod';
import { CURRENCIES } from '../../../format/money';
import type { Currency } from '../../../format/money';
import { parseMinor } from './money';
import { CSV_COLUMN_KEYS, CSV_DATE_FORMATS, CSV_DELIMITERS, CSV_ENCODINGS, IDENTIFIER_KINDS, IGNORE_REASONS, IMPORT_FORMATS, LEDGER_ROLES } from './model';
import type { AccountInput, CsvColumnKey, CsvColumns, CsvDateFormat, CsvDelimiter, CsvEncoding, CsvProfile, SettleInput } from './model';
import { isWholeNumber } from './money';

const MAX_COLUMN = 200;
const IBAN_MIN = 15;
const IBAN_MAX = 34;

export const reasonSchema = z.object({ reason: z.string().trim().min(3, 'Le motif doit contenir au moins 3 caractères.').max(255, 'Le motif ne peut pas dépasser 255 caractères.') });
export type ReasonValues = z.infer<typeof reasonSchema>;

export interface CsvDraft {
  enabled: boolean;
  delimiter: CsvDelimiter;
  encoding: CsvEncoding;
  hasHeader: boolean;
  dateFormat: CsvDateFormat;
  decimalSeparator: ',' | '.';
  thousandsSeparator: '' | '.' | ',';
  columns: Record<CsvColumnKey, string>;
}

const emptyColumns = (): Record<CsvColumnKey, string> => Object.fromEntries(CSV_COLUMN_KEYS.map((key) => [key, ''])) as Record<CsvColumnKey, string>;

export const defaultCsvDraft = (): CsvDraft => ({
  enabled: false,
  delimiter: ';',
  encoding: 'UTF-8',
  hasHeader: true,
  dateFormat: 'd/m/Y',
  decimalSeparator: ',',
  thousandsSeparator: '',
  columns: { ...emptyColumns(), booking_date: '1', label: '2', amount: '3' },
});

export function profileToDraft(profile: CsvProfile | null): CsvDraft {
  if (profile === null) return defaultCsvDraft();
  const columns = emptyColumns();
  for (const key of CSV_COLUMN_KEYS) columns[key] = String(profile.columns[key] ?? '');
  return {
    enabled: true,
    delimiter: profile.delimiter,
    encoding: profile.encoding ?? 'UTF-8',
    hasHeader: profile.hasHeader ?? true,
    dateFormat: profile.dateFormat,
    decimalSeparator: profile.decimalSeparator,
    thousandsSeparator: profile.thousandsSeparator === '.' || profile.thousandsSeparator === ',' ? profile.thousandsSeparator : '',
    columns,
  };
}

const columnValue = (text: string): string | number => {
  const value = text.trim();
  return isWholeNumber(value) && Number(value) >= 1 && Number(value) <= MAX_COLUMN ? Number(value) : value;
};

export function draftToProfile(draft: CsvDraft): CsvProfile | null {
  if (!draft.enabled) return null;
  const columns: CsvColumns = {};
  for (const key of CSV_COLUMN_KEYS) if (draft.columns[key].trim() !== '') columns[key] = columnValue(draft.columns[key]);
  return {
    delimiter: draft.delimiter,
    encoding: draft.encoding,
    hasHeader: draft.hasHeader,
    dateFormat: draft.dateFormat,
    decimalSeparator: draft.decimalSeparator,
    thousandsSeparator: draft.thousandsSeparator === '' ? null : draft.thousandsSeparator,
    columns,
  };
}

export const csvDraftSchema = z
  .object({
    enabled: z.boolean(),
    delimiter: z.enum(CSV_DELIMITERS),
    encoding: z.enum(CSV_ENCODINGS),
    hasHeader: z.boolean(),
    dateFormat: z.enum(CSV_DATE_FORMATS),
    decimalSeparator: z.enum([',', '.']),
    thousandsSeparator: z.enum(['', '.', ',']),
    columns: z.record(z.enum(CSV_COLUMN_KEYS), z.string().trim().max(80, 'Quatre-vingts caractères au plus.')),
  })
  .superRefine((draft, context) => {
    if (!draft.enabled) return;
    const filled = (key: CsvColumnKey): boolean => draft.columns[key].trim() !== '';
    if (!filled('booking_date')) context.addIssue({ code: 'custom', path: ['columns', 'booking_date'], message: 'Indiquez la colonne de la date de comptabilisation.' });
    if (!filled('label')) context.addIssue({ code: 'custom', path: ['columns', 'label'], message: 'Indiquez la colonne du libellé.' });
    if (!filled('amount') && !(filled('credit') && filled('debit'))) {
      context.addIssue({ code: 'custom', path: ['columns', 'amount'], message: 'Indiquez la colonne du montant, ou les colonnes crédit et débit.' });
    }
  });

export type CsvErrors = Readonly<Partial<Record<CsvColumnKey, string>>>;

export const accountFormSchema = (currency: Currency | null) =>
  z
    .object({
      ledgerRole: z.enum(LEDGER_ROLES),
      label: z.string().trim().min(1, 'Donnez un nom au compte.').max(120, 'Cent vingt caractères au plus.'),
      bankName: z.string().trim().max(120, 'Cent vingt caractères au plus.'),
      holderName: z.string().trim().min(1, 'Indiquez le titulaire du compte.').max(140, 'Cent quarante caractères au plus.'),
      identifierKind: z.enum(IDENTIFIER_KINDS),
      identifier: z.string(),
      country: z.string().trim().refine((value) => value === '' || value.length === 2, 'Code pays à deux lettres, ex. FR.'),
      reconciliationFrom: z.iso.date('Indiquez la date de début du suivi.'),
      openingBalance: z.string().trim().min(1, 'Indiquez le solde d’ouverture, 0 si le compte est neuf.'),
      currency: z.enum(CURRENCIES).or(z.literal('')),
      csv: csvDraftSchema,
    })
    .superRefine((values, context) => {
      const identifier = Array.from(values.identifier).filter((char) => char.trim() !== '');
      const [min, max] = values.identifierKind === 'iban' ? [IBAN_MIN, IBAN_MAX] : [4, 42];
      if (identifier.length < min || identifier.length > max) {
        context.addIssue({ code: 'custom', path: ['identifier'], message: values.identifierKind === 'iban' ? 'Saisissez l’IBAN complet (15 à 34 caractères).' : 'Saisissez le numéro de compte (4 à 42 caractères).' });
      }
      const money = currency ?? (values.currency === '' ? null : values.currency);
      if (money === null) context.addIssue({ code: 'custom', path: ['currency'], message: 'Choisissez la devise de l’organisation.' });
      else if (parseMinor(values.openingBalance, money, { signed: true }) === null) {
        context.addIssue({ code: 'custom', path: ['openingBalance'], message: money === 'XOF' ? 'Nombre entier de francs, ex. 1250000.' : 'Montant valide, ex. 1250,50.' });
      }
    });

export type AccountFormValues = z.input<ReturnType<typeof accountFormSchema>>;

export function accountFormToInput(values: z.output<ReturnType<typeof accountFormSchema>>, currency: Currency | null): AccountInput {
  const money = currency ?? (values.currency === '' ? 'EUR' : values.currency);
  return {
    ledgerRole: values.ledgerRole,
    label: values.label,
    bankName: values.bankName,
    holderName: values.holderName,
    identifierKind: values.identifierKind,
    identifier: values.identifier,
    country: values.country,
    reconciliationFrom: values.reconciliationFrom,
    openingBankBalance: parseMinor(values.openingBalance, money, { signed: true }) ?? 0,
    csvProfile: draftToProfile(values.csv),
  };
}

export const editAccountSchema = z.object({
  label: z.string().trim().min(1, 'Donnez un nom au compte.').max(120, 'Cent vingt caractères au plus.'),
  csv: csvDraftSchema,
});
export type EditAccountValues = z.input<typeof editAccountSchema>;

export const ignoreSchema = (paired: boolean) =>
  z
    .object({ reason: z.enum(IGNORE_REASONS, 'Choisissez un motif.'), pairLineId: z.string() })
    .refine((values) => !paired || values.pairLineId !== '', { path: ['pairLineId'], message: 'Choisissez l’opération opposée : sur le compte de tiers, les lignes s’ignorent par paire.' });
export type IgnoreValues = z.input<ReturnType<typeof ignoreSchema>>;

export const reconciliationFormSchema = z
  .object({
    accountId: z.string().min(1, 'Choisissez un compte.'),
    month: z.string().min(1, 'Choisissez un mois.'),
    enteredBalance: z.string().trim(),
    proof: z.instanceof(File).nullable(),
    currency: z.enum(CURRENCIES),
  })
  .superRefine((values, context) => {
    if (!z.iso.date().safeParse(`${values.month}-01`).success) context.addIssue({ code: 'custom', path: ['month'], message: 'Choisissez un mois valide.' });
    if (values.enteredBalance === '') return;
    if (parseMinor(values.enteredBalance, values.currency, { signed: true }) === null) context.addIssue({ code: 'custom', path: ['enteredBalance'], message: 'Montant valide, ex. 1250,50.' });
    if (values.proof === null) context.addIssue({ code: 'custom', path: ['proof'], message: 'Joignez la pièce qui justifie le solde saisi : relevé de la banque en PDF ou image.' });
  });
export type ReconciliationFormValues = z.input<typeof reconciliationFormSchema>;

export interface SettleDraft {
  mode: 'settle_lease' | 'settle_invoice' | 'bank_charges';
  allocations: { leaseId: string; amount: string }[];
  invoiceId: string;
  invoiceAmount: string;
}

export const settleFormSchema = (lineMinor: number, currency: Currency) =>
  z
    .object({
      mode: z.enum(['settle_lease', 'settle_invoice', 'bank_charges']),
      allocations: z.array(z.object({ leaseId: z.string(), amount: z.string() })),
      invoiceId: z.string(),
      invoiceAmount: z.string().trim(),
    })
    .superRefine((values, context) => {
      if (values.mode === 'settle_invoice') {
        if (values.invoiceId === '') context.addIssue({ code: 'custom', path: ['invoiceId'], message: 'Choisissez la facture à régler.' });
        const amount = values.invoiceAmount === '' ? null : parseMinor(values.invoiceAmount, currency);
        if (values.invoiceAmount !== '' && (amount === null || amount < 1 || amount > lineMinor)) context.addIssue({ code: 'custom', path: ['invoiceAmount'], message: 'Montant invalide : il ne peut pas dépasser la ligne du relevé.' });
        return;
      }
      if (values.mode !== 'settle_lease') return;
      let total = 0;
      const seen = new Set<string>();
      values.allocations.forEach((allocation, index) => {
        const amount = parseMinor(allocation.amount, currency);
        if (allocation.leaseId === '') context.addIssue({ code: 'custom', path: ['allocations', index, 'leaseId'], message: 'Choisissez un bail.' });
        else if (seen.has(allocation.leaseId)) context.addIssue({ code: 'custom', path: ['allocations', index, 'leaseId'], message: 'Ce bail est déjà dans la répartition.' });
        seen.add(allocation.leaseId);
        if (amount === null || amount < 1) context.addIssue({ code: 'custom', path: ['allocations', index, 'amount'], message: 'Montant strictement positif.' });
        else total += amount;
      });
      if (total !== lineMinor) context.addIssue({ code: 'custom', path: ['allocations'], message: 'La répartition doit totaliser exactement le montant de la ligne du relevé.' });
    });
export type SettleValues = z.input<ReturnType<typeof settleFormSchema>>;

export function settleFormToInput(values: SettleDraft, currency: Currency): SettleInput {
  if (values.mode === 'bank_charges') return { action: 'bank_charges' };
  if (values.mode === 'settle_invoice') return { action: 'settle_invoice', invoiceId: values.invoiceId, amount: values.invoiceAmount.trim() === '' ? null : parseMinor(values.invoiceAmount, currency) };
  return { action: 'settle_lease', allocations: values.allocations.map((item) => ({ leaseId: item.leaseId, amount: parseMinor(item.amount, currency) ?? 0 })) };
}

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export const IMPORT_EXTENSIONS = ['.csv', '.txt', '.xml'] as const;

export function importFileProblem(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!IMPORT_EXTENSIONS.some((extension) => name.endsWith(extension))) return 'Format non pris en charge : choisissez un fichier CSV ou camt.053 (XML).';
  if (file.size > MAX_IMPORT_BYTES) return 'Fichier trop volumineux : 10 Mo au maximum.';
  if (file.size === 0) return 'Le fichier est vide.';
  return null;
}

export const formatOfFile = (file: File): (typeof IMPORT_FORMATS)[number] => (file.name.toLowerCase().endsWith('.xml') ? 'camt053' : 'csv');

export const importFormSchema = z.object({
  accountId: z.string().min(1, 'Choisissez le compte du relevé.'),
  file: z.custom<File | null>((value) => value === null || value instanceof File).refine((value) => value !== null, 'Choisissez le fichier du relevé.'),
  format: z.enum(IMPORT_FORMATS),
  csv: csvDraftSchema,
});
export type ImportFormValues = z.input<typeof importFormSchema>;

import type { z } from 'zod';
import { invalidInput } from './bankingErrors';
import {
  acceptBodySchema,
  buildBodySchema,
  createAccountBodySchema,
  idempotencyKeySchema,
  ignoreBodySchema,
  importFormatSchema,
  matchBodySchema,
  reasonSchema,
  replaceAccountBodySchema,
  restoreBodySchema,
  settleBodySchema,
  updateAccountBodySchema,
} from './payloadSchemas';
import type { AccountInput, BuildReconciliationInput, CsvColumns, CsvProfile, IgnoreReason, ImportFormat, SettleInput } from '../model';

function check<S extends z.ZodType>(schema: S, value: unknown, message: string): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw invalidInput(message);
  return parsed.data;
}

const orUndefined = (text: string): string | undefined => (text.trim() === '' ? undefined : text.trim());
const compact = (text: string): string => Array.from(text).filter((char) => char.trim() !== '').join('');
const asColumn = (value: string | number): string | number => (typeof value === 'number' ? value : value.trim());

export const assertKey = (key: string): string => check(idempotencyKeySchema, key, 'La clé de saisie est invalide : rechargez la page.');
export const reasonOf = (reason: string): string => check(reasonSchema, reason, 'Le motif doit contenir entre 3 et 255 caractères.');

function columnsBody(columns: CsvColumns): Record<string, string | number> {
  const body: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(columns)) if (String(value).trim() !== '') body[key] = asColumn(value);
  return body;
}

function profileBody(profile: CsvProfile): Record<string, unknown> {
  return {
    delimiter: profile.delimiter,
    ...(profile.encoding === null ? {} : { encoding: profile.encoding }),
    ...(profile.hasHeader === null ? {} : { has_header: profile.hasHeader }),
    date_format: profile.dateFormat,
    decimal_separator: profile.decimalSeparator,
    ...(profile.thousandsSeparator === '.' || profile.thousandsSeparator === ',' ? { thousands_separator: profile.thousandsSeparator } : {}),
    columns: columnsBody(profile.columns),
  };
}

const PROFILE_MESSAGE = 'Le profil CSV est invalide : renseignez le séparateur, les formats, les colonnes date, libellé et montant (ou crédit et débit).';

export function createAccountPayload(input: AccountInput): Record<string, unknown> {
  return check(
    createAccountBodySchema,
    {
      ledger_role: input.ledgerRole,
      label: input.label,
      bank_name: orUndefined(input.bankName),
      holder_name: input.holderName,
      identifier_kind: input.identifierKind,
      identifier: compact(input.identifier),
      country: orUndefined(input.country)?.toUpperCase(),
      reconciliation_from: input.reconciliationFrom,
      opening_bank_balance: input.openingBankBalance,
      csv_profile: input.csvProfile === null ? undefined : profileBody(input.csvProfile),
    },
    input.csvProfile === null ? 'Le compte est invalide : relisez les champs.' : PROFILE_MESSAGE,
  );
}

export function replaceAccountPayload(input: AccountInput): Record<string, unknown> {
  return check(
    replaceAccountBodySchema,
    {
      label: input.label,
      bank_name: orUndefined(input.bankName),
      holder_name: input.holderName,
      identifier_kind: input.identifierKind,
      identifier: compact(input.identifier),
      country: orUndefined(input.country)?.toUpperCase(),
      reconciliation_from: input.reconciliationFrom,
      opening_bank_balance: input.openingBankBalance,
      csv_profile: input.csvProfile === null ? undefined : profileBody(input.csvProfile),
    },
    input.csvProfile === null ? 'Le compte est invalide : relisez les champs.' : PROFILE_MESSAGE,
  );
}

export function updateAccountPayload(label: string, profile: CsvProfile | null): Record<string, unknown> {
  return check(updateAccountBodySchema, { label, csv_profile: profile === null ? undefined : profileBody(profile) }, profile === null ? 'Le libellé du compte est obligatoire.' : PROFILE_MESSAGE);
}

export function statementForm(file: File, format: ImportFormat, profile: CsvProfile | null): FormData {
  const body = new FormData();
  body.set('file', file);
  body.set('format', check(importFormatSchema, format, 'Le format du fichier est invalide.'));
  if (format === 'csv' && profile !== null) {
    const checked = check(createAccountBodySchema.shape.csv_profile.unwrap(), profileBody(profile), PROFILE_MESSAGE);
    body.set('csv_profile[delimiter]', checked.delimiter);
    if (checked.encoding !== undefined) body.set('csv_profile[encoding]', checked.encoding);
    if (checked.has_header !== undefined) body.set('csv_profile[has_header]', checked.has_header ? '1' : '0');
    body.set('csv_profile[date_format]', checked.date_format);
    body.set('csv_profile[decimal_separator]', checked.decimal_separator);
    if (checked.thousands_separator !== undefined) body.set('csv_profile[thousands_separator]', checked.thousands_separator);
    for (const [key, value] of Object.entries(checked.columns)) body.set(`csv_profile[columns][${key}]`, String(value));
  }
  return body;
}

export function settlePayload(input: SettleInput, lockVersion: number): Record<string, unknown> {
  const raw =
    input.action === 'settle_lease'
      ? { action: input.action, allocations: input.allocations.map((item) => ({ lease_id: item.leaseId, amount: item.amount })), lock_version: lockVersion }
      : input.action === 'settle_invoice'
        ? { action: input.action, invoice_id: input.invoiceId, ...(input.amount === null ? {} : { amount: input.amount }), lock_version: lockVersion }
        : { action: input.action, lock_version: lockVersion };
  return check(settleBodySchema, raw, 'La création depuis la ligne est invalide : relisez la répartition.');
}

export const matchPayload = (otherLineIds: readonly string[], journalLineIds: readonly string[], lockVersion: number): Record<string, unknown> =>
  check(matchBodySchema, { line_ids: otherLineIds, journal_line_ids: journalLineIds, lock_version: lockVersion }, 'Le pointage est invalide : choisissez au moins une écriture.');

export const ignorePayload = (reason: IgnoreReason, pairLineId: string | null, lockVersion: number): Record<string, unknown> =>
  check(ignoreBodySchema, { reason, pair_line_id: pairLineId ?? undefined, lock_version: lockVersion }, 'Le motif d’exclusion est invalide.');

export const restorePayload = (lockVersion: number): Record<string, unknown> => check(restoreBodySchema, { lock_version: lockVersion }, 'La version de la ligne est invalide : rechargez la page.');

export const acceptPayload = (suggestionIds: readonly string[]): Record<string, unknown> =>
  check(acceptBodySchema, { suggestion_ids: suggestionIds }, 'Choisissez entre 1 et 50 propositions.');

export function reconciliationForm(input: BuildReconciliationInput): FormData {
  const checked = check(buildBodySchema, { bank_account_id: input.accountId, month: input.month, bank_balance: input.bankBalance ?? undefined }, 'Le mois ou le solde saisi est invalide.');
  const body = new FormData();
  body.set('bank_account_id', checked.bank_account_id);
  body.set('month', checked.month);
  if (checked.bank_balance !== undefined) body.set('bank_balance', String(checked.bank_balance));
  if (input.proof !== null) body.set('proof', input.proof);
  return body;
}

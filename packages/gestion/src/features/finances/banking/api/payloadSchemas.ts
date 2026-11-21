import { z } from 'zod';
import { CSV_DATE_FORMATS, CSV_DELIMITERS, CSV_ENCODINGS, IDENTIFIER_KINDS, IGNORE_REASONS, IMPORT_FORMATS, LEDGER_ROLES } from '../model';

const uuid = z.guid();
const MAX_MINOR = 100_000_000_000_000;
const KEY_EXTRA = '._:-';

const isKeyChar = (char: string): boolean => (char >= 'A' && char <= 'Z') || (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9') || KEY_EXTRA.includes(char);

export const idempotencyKeySchema = z
  .string()
  .min(8)
  .max(120)
  .refine((key) => Array.from(key).every(isKeyChar));
export const reasonSchema = z.string().trim().min(3).max(255);
export const lockVersionSchema = z.number().int().min(1);
export const minorSchema = z.number().int().min(-MAX_MINOR).max(MAX_MINOR);
export const positiveMinorSchema = z.number().int().min(1).max(MAX_MINOR);
export const monthSchema = z
  .string()
  .length(7)
  .refine((month) => z.iso.date().safeParse(`${month}-01`).success);

const column = z.union([z.number().int().min(1).max(200), z.string().trim().min(1).max(80)]);

export const csvProfileBodySchema = z.object({
  delimiter: z.enum(CSV_DELIMITERS),
  encoding: z.enum(CSV_ENCODINGS).optional(),
  has_header: z.boolean().optional(),
  date_format: z.enum(CSV_DATE_FORMATS),
  decimal_separator: z.enum([',', '.']),
  thousands_separator: z.enum(['.', ',']).optional(),
  columns: z
    .object({
      booking_date: column,
      label: column,
      amount: column.optional(),
      credit: column.optional(),
      debit: column.optional(),
      value_date: column.optional(),
      bank_reference: column.optional(),
      end_to_end_id: column.optional(),
      remittance_reference: column.optional(),
      counterparty_name: column.optional(),
      counterparty_iban: column.optional(),
      transaction_code: column.optional(),
    })
    .refine((columns) => columns.amount !== undefined || (columns.credit !== undefined && columns.debit !== undefined)),
});

const accountFields = {
  label: z.string().trim().min(1).max(120),
  bank_name: z.string().trim().max(120).optional(),
  holder_name: z.string().trim().min(1).max(140),
  identifier_kind: z.enum(IDENTIFIER_KINDS),
  identifier: z.string().min(4).max(42),
  country: z.string().length(2).optional(),
  reconciliation_from: z.iso.date(),
  opening_bank_balance: minorSchema,
  csv_profile: csvProfileBodySchema.optional(),
};

export const createAccountBodySchema = z.object({ ledger_role: z.enum(LEDGER_ROLES), ...accountFields });
export const replaceAccountBodySchema = z.object(accountFields);
export const updateAccountBodySchema = z.object({ label: accountFields.label, csv_profile: csvProfileBodySchema.optional() });

export const settleBodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('settle_lease'),
    allocations: z.array(z.object({ lease_id: uuid, amount: positiveMinorSchema })).min(1).max(20),
    lock_version: lockVersionSchema,
  }),
  z.object({ action: z.literal('settle_invoice'), invoice_id: uuid, amount: positiveMinorSchema.optional(), lock_version: lockVersionSchema }),
  z.object({ action: z.literal('bank_charges'), lock_version: lockVersionSchema }),
]);

export const matchBodySchema = z.object({
  line_ids: z.array(uuid).max(49),
  journal_line_ids: z.array(uuid).min(1).max(200),
  lock_version: lockVersionSchema,
});

export const ignoreBodySchema = z.object({ reason: z.enum(IGNORE_REASONS), pair_line_id: uuid.optional(), lock_version: lockVersionSchema });
export const restoreBodySchema = z.object({ lock_version: lockVersionSchema });
export const acceptBodySchema = z.object({ suggestion_ids: z.array(uuid).min(1).max(50) });
export const importFormatSchema = z.enum(IMPORT_FORMATS);
export const buildBodySchema = z.object({ bank_account_id: uuid, month: monthSchema, bank_balance: minorSchema.optional() });

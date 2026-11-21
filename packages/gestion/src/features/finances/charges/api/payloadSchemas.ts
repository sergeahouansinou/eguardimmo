import { z } from 'zod';
import { EXPENSE_KINDS, EXPENSE_SETTLEMENTS, KEY_KINDS, PLAN_BASES, SOURCE_KINDS } from '../model';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const uuid = z.guid();
const optionalText = (max: number) => z.string().trim().max(max);

export const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9._:-]{8,64}$/);
export const reasonSchema = z.string().trim().min(3).max(255);
export const expenseBodySchema = z.object({
  property_id: uuid,
  unit_id: uuid.optional(),
  kind: z.enum(EXPENSE_KINDS),
  category_term_id: uuid,
  payee_label: optionalText(120).optional(),
  reference: optionalText(64).optional(),
  document_on: isoDate,
  service_from: isoDate,
  service_to: isoDate,
  total_gross: z.number().int().min(1).max(100_000_000_000),
  tax_amount: z.number().int().min(0).max(100_000_000_000),
  recoverable_amount: z.number().int().min(0).max(100_000_000_000),
  recoverable_rubric: optionalText(64).optional(),
  settlement: z.enum(EXPENSE_SETTLEMENTS),
  paid_on: isoDate.optional(),
});

export const itemBodySchema = z.object({
  label: z.string().trim().min(1).max(120),
  rubric: z.string().trim().min(1).max(64),
  key_id: uuid.optional(),
  unit_id: uuid.optional(),
  sources: z
    .array(z.object({ kind: z.enum(SOURCE_KINDS), id: uuid, amount: z.number().int().min(1).max(999_999_999_999).optional() }))
    .min(1)
    .max(100),
  consumptions: z.array(z.object({ unit_id: uuid, quantity_milli: z.number().int().min(1).max(999_999_999_999) })).max(500),
});

export const exerciseBodySchema = z.object({
  property_id: uuid,
  period_start: isoDate,
  period_end: isoDate,
  items: z.array(itemBodySchema).max(100),
});

export const keyBodySchema = z.object({
  label: z.string().trim().min(2).max(120),
  kind: z.enum(KEY_KINDS),
  valid_from: isoDate,
  shares: z.array(z.object({ unit_id: uuid, weight: z.number().int().min(0).max(1_000_000_000) })).max(500),
});

export const planBodySchema = z.object({ reason: reasonSchema, basis: z.enum(PLAN_BASES) });

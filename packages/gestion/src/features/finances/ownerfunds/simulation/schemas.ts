import { z } from 'zod';
import { CURRENCIES } from '../../../../format/money';
import { FEE_KINDS } from '../model';
import { AMOUNT_SOURCES, FEE_BASES, FEE_TAX_MODES } from './model';

const id = z.guid();
const money = z.object({ amount: z.number().int(), currency: z.enum(CURRENCIES) });
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

const amounts = z.object({
  source: z.enum(AMOUNT_SOURCES),
  fee_net: money,
  tax_amount: money,
  fee_total: money,
  minimum_applied: z.boolean(),
});

const monthSchema = z.object({
  month,
  base_rent: money,
  base_charges: money,
  current: amounts.nullable(),
  simulated: amounts,
  difference: z.object({ fee_net: money, fee_total: money }).nullable(),
});

const totals = z.object({
  simulated_fee_net: money,
  simulated_fee_total: money,
  current_fee_net: money.nullable(),
  current_fee_total: money.nullable(),
  difference_fee_net: money.nullable(),
  difference_fee_total: money.nullable(),
});

export const apiSimulationResponse = z
  .object({
    data: z.array(monthSchema),
    meta: z.object({
      mandate_id: id,
      months_requested: z.number().int().min(1).max(12),
      months_returned: z.number().int().min(0).max(12),
      currency: z.enum(CURRENCIES),
      reason: z.literal('no_closed_period').nullable(),
      totals: totals.nullable(),
    }),
  })
  .refine(({ data, meta }) => meta.months_returned === data.length, { message: 'months_returned', path: ['meta', 'months_returned'] })
  .refine(({ data, meta }) => (data.length === 0 ? meta.reason !== null && meta.totals === null : meta.reason === null && meta.totals !== null), { message: 'reason', path: ['meta', 'reason'] });

const mandateTerms = z.object({
  fee_kind: z.enum(FEE_KINDS),
  fee_basis_points: z.number().int().min(0).max(10_000).nullable(),
  fee_flat_amount: money.nullable(),
  fee_base: z.enum(FEE_BASES).nullable(),
  fee_minimum_amount: money,
  fee_tax_mode: z.enum(FEE_TAX_MODES),
});

const feeMandate = z.object({
  id,
  reference: z.string(),
  status: z.string(),
  mandant: z.object({ display_name: z.string(), is_anonymized: z.boolean() }),
  currency: z.enum(CURRENCIES),
  terms: mandateTerms.nullable(),
});

export const apiFeeMandatePage = z.object({
  data: z.array(feeMandate),
  meta: z.object({ per_page: z.number().int().nonnegative(), next_cursor: z.string().nullable() }),
});

export type ApiSimulationResponse = z.infer<typeof apiSimulationResponse>;
export type ApiFeeMandate = z.infer<typeof feeMandate>;

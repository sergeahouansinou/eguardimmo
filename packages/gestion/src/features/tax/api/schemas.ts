import { z } from 'zod';
import { CURRENCIES } from '../../../format/money';
import { LINE_STATUSES, SUMMARY_STATUSES } from '../model';

const id = z.guid();
const timestamp = z.iso.datetime({ offset: true });
const money = z.object({ amount: z.number().int(), currency: z.enum(CURRENCIES) });

const line = z.object({
  code: z.string(),
  label: z.string(),
  status: z.enum(LINE_STATUSES),
  exact: money,
  rounded: money,
  sources: z.array(z.object({ kind: z.string(), ref: z.string().nullable(), amount: money })),
  sources_truncated: z.boolean(),
});

export const apiTaxIncome = z.object({
  income_year: z.number().int(),
  form_version: z.string(),
  currency: z.enum(CURRENCIES),
  provisional: z.boolean(),
  household_complete: z.boolean(),
  properties: z.array(
    z.object({
      property_id: id.nullable(),
      name: z.string(),
      premises: z.number().int(),
      co_owners: z.array(z.object({ share_bp: z.number().int(), nature: z.string() })),
      lines: z.array(line),
    }),
  ),
  totals: z.array(line),
  micro: z.object({ gross_receipts: money, allowance_bp: z.number().int(), base_after_allowance: money, threshold: money, real_base: money }),
  deficit: z
    .object({ result: money, interest_part: money, other_part: money, imputable_on_global_income: money, carried_forward: money })
    .nullable(),
  warnings: z.array(z.object({ code: z.string(), property_id: id.nullable(), message: z.string().nullable() })),
  warning: z.string(),
  mentions: z.array(z.string()),
  blockers: z.array(z.object({ code: z.string(), property_id: id })).optional(),
});

export const apiRentalIncome = z.object({ data: apiTaxIncome });

export const apiSummary = z.object({
  id,
  scope: z.enum(['organization', 'mandant']),
  mandant_party_id: id.nullable(),
  income_year: z.number().int(),
  form_version: z.string(),
  status: z.enum(SUMMARY_STATUSES),
  currency: z.enum(CURRENCIES),
  template_version: z.string(),
  supersedes_id: id.nullable(),
  rectification_reason: z.string().nullable(),
  has_pdf: z.boolean(),
  published_at: timestamp.nullable(),
  lock_version: z.number().int().positive(),
  created_at: timestamp.nullable(),
  totals: z.array(z.object({ code: z.string(), amount: money })).optional(),
  income: apiTaxIncome.optional(),
});

export const apiSummaryOne = z.object({ data: apiSummary });
export const apiSummaryPage = z.object({ data: z.array(apiSummary), meta: z.object({ next_cursor: z.string().nullable(), per_page: z.number().int() }) });

export const apiGeneration = z.object({
  data: z.array(
    z.object({
      mandant_id: id,
      outcome: z.enum(['created', 'replayed', 'failed']),
      statement: apiSummary.nullable(),
      error: z.object({ code: z.string(), status: z.number().int(), detail: z.string() }).nullable(),
    }),
  ),
});

export const apiMandantPage = z.object({ data: z.array(z.object({ party_id: id, display_name: z.string() })) });

export type ApiTaxIncome = z.infer<typeof apiTaxIncome>;
export type ApiSummary = z.infer<typeof apiSummary>;

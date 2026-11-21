import { z } from 'zod';
import { CURRENCIES } from '../../../format/money';
import { AGING_BUCKETS, LINE_KINDS, PERIOD_KINDS, REPORT_STATUSES, SECTIONS } from '../model';

const id = z.guid();
const timestamp = z.iso.datetime({ offset: true });
const isoDate = z.iso.date();
const yearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const count = z.number().int().nonnegative();
const money = z.object({ amount: z.number().int(), currency: z.enum(CURRENCIES) });
const cursorMeta = z.object({ per_page: z.number().int().nonnegative(), next_cursor: z.string().nullable() });
const period = z.object({ start: isoDate, end: isoDate });

const rentCard = {
  month: yearMonth,
  currency: z.enum(CURRENCIES),
  rent_called: money,
  rent_collected: money,
  collection_rate_basis_points: z.number().int().nullable(),
};

export const apiAgencyKpisSchema = z.object({ ...rentCard, fees_net: money, period_closed: z.boolean() });

export const apiLandlordSchema = z.object({
  ...rentCard,
  leases_ending: count,
  vacant_units: count,
  open_interventions: count,
  certificates_to_renew: count,
});

export const apiPayoutsSchema = z.object({
  currency: z.enum(CURRENCIES),
  payable_total: money,
  in_transit_total: money,
  mandants_with_payable: count,
  top_mandants: z.array(z.object({ party_id: id, name: z.string().nullable(), payable: money })),
  active_holds: count,
  pending_items: count,
});

export const apiAlertsSchema = z.object({
  mandates_to_renew: z.object({ count, next: z.array(z.object({ id, reference: z.string(), ends_on: isoDate })) }),
  certificates_to_renew: count,
  reports_due: z.object({ period, count, mandant_ids: z.array(id) }),
});

export const apiAgingSchema = z.object({
  as_of: isoDate,
  currency: z.enum(CURRENCIES),
  buckets: z.array(z.object({ bucket: z.enum(AGING_BUCKETS), amount: money, count })),
  total: money,
  count,
});

const optionsSchema = z.preprocess(
  (value) => (Array.isArray(value) ? {} : value),
  z.object({ letterhead: z.boolean().optional(), reminder_detail: z.boolean().optional(), receipts_attached: z.boolean().optional() }),
);

const nullableMoney = money.nullable();

export const apiLineSchema = z.object({
  position: z.number().int(),
  kind: z.enum(LINE_KINDS),
  date: isoDate,
  unit_id: id.nullable(),
  lease_id: id.nullable(),
  mandate_id: id.nullable(),
  label: z.string(),
  amount: money,
  direction: z.enum(['credit', 'debit']),
});

export const apiReportSchema = z.object({
  id,
  number: z.string().nullable(),
  status: z.enum(REPORT_STATUSES),
  mandant: z.object({ party_id: id, name: z.string().nullable() }),
  period: z.object({ kind: z.enum(PERIOD_KINDS), start: isoDate, end: isoDate }),
  currency: z.enum(CURRENCIES),
  sections: z.array(z.enum(SECTIONS)),
  options: optionsSchema,
  totals: z.object({
    opening_balance: nullableMoney,
    collected: nullableMoney,
    fees: nullableMoney,
    works: nullableMoney,
    payout: nullableMoney,
    adjustments: nullableMoney,
    closing_balance: nullableMoney,
  }),
  template_version: z.string().nullable(),
  supersedes_id: id.nullable(),
  rectification_reason: z.string().nullable(),
  scheduled_for: timestamp.nullable(),
  notify: z.boolean(),
  generated_at: timestamp.nullable(),
  published_at: timestamp.nullable(),
  first_read_at: timestamp.nullable(),
  lock_version: z.number().int().positive(),
  lines: z.array(apiLineSchema).optional(),
  units: z
    .array(z.object({ id, reference: z.string(), property_name: z.string().nullable(), tenants: z.array(z.string()) }))
    .optional(),
  mandates: z
    .array(z.object({ id, reference: z.string(), fee_kind: z.string().nullable().optional(), fee_basis_points: z.number().int().nullable().optional() }))
    .optional(),
});

export const apiReportResponse = z.object({ data: apiReportSchema });

export const apiReportPage = z.object({
  data: z.array(apiReportSchema),
  meta: cursorMeta.extend({ due: z.object({ period, mandants: z.array(z.object({ party_id: id, name: z.string() })) }).optional() }),
});

export const apiCreateResponse = z.object({
  data: z.array(
    z.object({
      mandant_id: id,
      outcome: z.enum(['created', 'replayed', 'failed']),
      report: apiReportSchema.nullable(),
      error: z.object({ code: z.string(), status: z.number().int(), detail: z.string() }).nullable(),
    }),
  ),
});

export const apiStatementSchema = z.object({
  mandant: z.object({ party_id: id, name: z.string().nullable() }),
  from: isoDate,
  to: isoDate,
  opening_balance: money,
  closing_balance: money,
  lines: z.array(
    z.object({
      date: isoDate,
      reference: z.string().nullable(),
      label: z.string(),
      source: z.string(),
      is_reversal: z.boolean(),
      debit: money,
      credit: money,
      balance: money,
    }),
  ),
});

export const apiMandantPage = z.object({
  data: z.array(z.object({ party_id: id, display_name: z.string() })),
});

export const apiPartyResponse = z.object({ data: z.object({ id, display_name: z.string(), is_anonymized: z.boolean() }) });

export type ApiReport = z.infer<typeof apiReportSchema>;
export type ApiLine = z.infer<typeof apiLineSchema>;
export type ApiAgencyKpis = z.infer<typeof apiAgencyKpisSchema>;
export type ApiLandlord = z.infer<typeof apiLandlordSchema>;
export type ApiPayouts = z.infer<typeof apiPayoutsSchema>;
export type ApiAlerts = z.infer<typeof apiAlertsSchema>;
export type ApiAging = z.infer<typeof apiAgingSchema>;
export type ApiStatement = z.infer<typeof apiStatementSchema>;
export type ApiCreateResult = z.infer<typeof apiCreateResponse>['data'][number];

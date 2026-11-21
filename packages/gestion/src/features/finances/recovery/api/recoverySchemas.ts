import { z } from 'zod';
import { INSTALLMENT_STATUSES } from '../../rent/model';
import { apiMoneySchema } from '../../rent/api/rentSchemas';
import { ACT_TYPES, CASE_STATUSES, RECEIVABLE_TYPES, TRANSMISSION_STATES } from '../model';

const id = z.guid();
const isoDate = z.iso.date();
const timestamp = z.iso.datetime({ offset: true });
const count = z.number().int().nonnegative();
const money = apiMoneySchema;
const period = z.object({ start: isoDate, end: isoDate });
const receivableType = z.enum(RECEIVABLE_TYPES);

const caseSummaryFields = {
  id,
  number: z.string(),
  status: z.enum(CASE_STATUSES),
  lease: z.object({ id, reference: z.string().nullable() }),
  debtor: z.object({ id, name: z.string().nullable() }),
  currency: z.string().length(3),
  opened_on: isoDate,
  closed_on: isoDate.nullable(),
  status_reason: z.string().nullable(),
  items_count: count,
  outstanding: money,
};

export const apiUnpaidSchema = z.object({
  type: receivableType,
  item_id: id,
  installment_id: id.nullable(),
  invoice_id: id.nullable(),
  reference: z.string().nullable(),
  lease: z.object({ id, reference: z.string().nullable() }),
  party: z.object({ id, name: z.string().nullable() }).nullable(),
  period: period.nullable(),
  issued_on: isoDate.nullable(),
  due_date: isoDate,
  days_overdue: count,
  status: z.enum(INSTALLMENT_STATUSES).nullable(),
  total: money,
  outstanding: money,
  case: z.object({ id, number: z.string() }).nullable(),
});

export const apiCaseItemSchema = z.object({
  id,
  type: receivableType,
  item_id: id,
  installment_id: id.nullable(),
  invoice_id: id.nullable(),
  reference: z.string().nullable(),
  period: period.nullable(),
  issued_on: isoDate.nullable(),
  due_date: isoDate,
  total: money,
  amount_due_at_inclusion: money,
  outstanding: money.nullable(),
  included_at: timestamp,
  removed_at: timestamp.nullable(),
});

export const apiCaseBundleSchema = z.object({
  id,
  number: z.string(),
  generated_on: isoDate,
  total_due: money,
  pieces_count: count,
  transmissions_count: count.nullable(),
});

export const apiCaseSummarySchema = z.object(caseSummaryFields);

export const apiCaseSchema = z.object({
  ...caseSummaryFields,
  items: z.array(apiCaseItemSchema),
  bundles: z.array(apiCaseBundleSchema).optional(),
});

export const apiActSchema = z.object({
  id,
  case_id: id,
  type: z.enum(ACT_TYPES),
  performed_on: isoDate,
  author_user_id: id.nullable(),
  reference: z.string().nullable(),
  note: z.string().nullable(),
  details: z
    .object({ recipient_name: z.string().optional(), pieces_count: count.optional(), expires_at: timestamp.optional() })
    .nullable(),
  created_at: timestamp,
});

export const apiTransmissionSchema = z.object({
  id,
  bundle_id: id,
  recipient: z.object({ party_id: id, email: z.string() }),
  state: z.enum(TRANSMISSION_STATES),
  expires_at: timestamp,
  revoked_at: timestamp.nullable(),
  sent_at: timestamp.nullable(),
  first_downloaded_at: timestamp.nullable(),
  download_count: count,
  replaces_id: id.nullable(),
  created_at: timestamp,
});

export const apiBundleSchema = z.object({
  id,
  case_id: id,
  number: z.string(),
  generated_on: isoDate,
  size_bytes: count,
  sha256: z.string(),
  total_due: money,
  pieces: z.array(z.object({ kind: z.string(), label: z.string(), number: z.string().nullable(), file_name: z.string(), sha256: z.string() })),
  statement: z.object({ currency: z.string().length(3), totals: z.object({ called: z.number().int(), outstanding: z.number().int() }) }),
  transmissions: z.array(apiTransmissionSchema).optional(),
});

export const apiBailiffTermsSchema = z.object({
  data: z.array(z.object({ id, semantic_key: z.string().nullable(), archived: z.boolean() })),
});

const apiPartySchema = z.object({ id, display_name: z.string(), primary_email: z.string().nullable(), is_anonymized: z.boolean(), archived_at: timestamp.nullable() });

const cursorMeta = z.object({ per_page: count, next_cursor: z.string().nullable() });

export const apiUnpaidPage = z.object({ data: z.array(apiUnpaidSchema), meta: z.object({ next_after: id.nullable() }) });
export const apiCasePage = z.object({ data: z.array(apiCaseSummarySchema), meta: cursorMeta });
export const apiCaseResponse = z.object({ data: apiCaseSchema });
export const apiActResponse = z.object({ data: apiActSchema });
export const apiActPage = z.object({ data: z.array(apiActSchema), meta: cursorMeta });
export const apiBundleResponse = z.object({ data: apiBundleSchema });
export const apiTransmissionResponse = z.object({ data: apiTransmissionSchema });
export const apiPartyPage = z.object({ data: z.array(apiPartySchema), meta: cursorMeta });

export type ApiUnpaid = z.infer<typeof apiUnpaidSchema>;
export type ApiCase = z.infer<typeof apiCaseSchema>;
export type ApiCaseSummary = z.infer<typeof apiCaseSummarySchema>;
export type ApiAct = z.infer<typeof apiActSchema>;
export type ApiBundle = z.infer<typeof apiBundleSchema>;
export type ApiTransmission = z.infer<typeof apiTransmissionSchema>;
export type ApiBailiffParty = z.infer<typeof apiPartySchema>;
export type ApiPartyPage = z.infer<typeof apiPartyPage>;

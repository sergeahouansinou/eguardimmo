import { z } from 'zod';

const id = z.guid();
const isoDate = z.iso.date();
const count = z.number().int().nonnegative();

export const apiMoneySchema = z.object({ amount: z.number().int(), currency: z.string().length(3) });

export const apiUnitSchema = z.object({
  id,
  reference: z.string(),
  property: z.object({ id, name: z.string() }),
});

export const apiPartySchema = z.object({
  id,
  display_name: z.string(),
  kind: z.string(),
  is_anonymized: z.boolean(),
});

export const apiComponentSchema = z.object({
  id,
  key: z.string().optional(),
  label: z.string().optional(),
  semantic_key: z.string().nullable().optional(),
});

export const LEASE_PHASES = ['draft', 'upcoming', 'running', 'notice', 'ended'] as const;
export const leasePhaseSchema = z.enum(LEASE_PHASES);
export type ApiLeasePhase = z.infer<typeof leasePhaseSchema>;

export const API_PAYMENT_METHODS = ['transfer', 'direct_debit', 'card', 'cheque', 'cash'] as const;
export const apiPaymentMethodSchema = z.enum(API_PAYMENT_METHODS);
export type ApiPaymentMethod = z.infer<typeof apiPaymentMethodSchema>;

export const apiTermSchema = z.object({
  id,
  component: apiComponentSchema,
  amount: apiMoneySchema,
  vat_bp: z.number().int(),
  indexed: z.boolean(),
  valid_from: isoDate,
  end_date: isoDate.nullable(),
  in_force: z.boolean(),
  reason: z.enum(['initial', 'revision', 'amendment', 'renewal', 'correction']),
  replaces_id: id.nullable(),
});
export type ApiTerm = z.infer<typeof apiTermSchema>;

export const apiLeaseSummarySchema = z.object({
  id,
  reference: z.string().min(1),
  jurisdiction: z.string(),
  regime_key: z.string(),
  status: z.enum(['draft', 'signed', 'terminated', 'cancelled']),
  phase: leasePhaseSchema,
  starts_on: isoDate,
  end_date: isoDate.nullable(),
  duration_months: z.number().int().positive().nullable(),
  tacit_renewal: z.boolean(),
  periodicity: z.enum(['monthly', 'quarterly', 'semiannual', 'annual']),
  currency: z.string().length(3),
  main_unit: apiUnitSchema.nullable(),
  tenants: z.array(apiPartySchema),
  lock_version: z.number().int().positive(),
  archived_at: z.iso.datetime({ offset: true }).nullable(),
});
export type ApiLeaseSummary = z.infer<typeof apiLeaseSummarySchema>;

const apiNoticeSchema = z.object({
  received_on: isoDate,
  given_by: z.enum(['tenant', 'landlord']).nullable(),
  departure_on: isoDate.nullable(),
  reason: z.string().nullable(),
});

export const apiLeaseSchema = apiLeaseSummarySchema.extend({
  billing_timing: z.enum(['advance', 'arrears']),
  due_day: z.number().int().min(1).max(28),
  payment_method: apiPaymentMethodSchema.nullable(),
  signed_on: isoDate.nullable(),
  signed_file_id: id.nullable(),
  notice: apiNoticeSchema.nullable(),
  jurisdiction_data: z.record(z.string(), z.unknown()),
  custom_fields: z.record(z.string(), z.unknown()),
  note: z.string().nullable(),
  units: z.array(
    z.object({
      id,
      unit: apiUnitSchema.or(z.object({ id })),
      is_main: z.boolean(),
      valid_from: isoDate,
      end_date: isoDate.nullable(),
    }),
  ),
  parties: z.array(
    z.object({
      id,
      party: apiPartySchema,
      role: z.enum(['tenant', 'guarantor', 'occupant']),
      joint_liability: z.boolean(),
      guarantees_party_id: id.nullable(),
      guarantee: z.object({ limit: apiMoneySchema, ends_on: isoDate.nullable() }).nullable(),
      valid_from: isoDate,
      end_date: isoDate.nullable(),
    }),
  ),
  terms: z.array(apiTermSchema),
});
export type ApiLease = z.infer<typeof apiLeaseSchema>;
export type ApiLeaseParty = ApiLease['parties'][number];

export const apiLeaseResponseSchema = z.object({ data: apiLeaseSchema });

export const apiLeasePageSchema = z.object({
  data: z.array(apiLeaseSummarySchema),
  meta: z.object({ per_page: count, next_cursor: z.string().nullable() }),
});

export const apiTermsResponseSchema = z.object({
  data: z.array(apiTermSchema),
  meta: z.object({ lock_version: z.number().int().positive() }),
});

export const apiRegimeSchema = z.object({
  key: z.string(),
  label: z.string(),
  jurisdiction: z.string().regex(/^[A-Z]{2}$/),
  currency: z.string().length(3),
  defaults: z.object({
    duration_months: z.number().int(),
    minimum_duration_months: z.number().int(),
    maximum_duration_months: z.number().int().nullable(),
    tacit_renewal: z.boolean(),
    renewal_months: z.number().int().nullable(),
    deposit_cap_months: z.number().int().nullable(),
    tenant_notice_months: z.number().int().nullable(),
    landlord_notice_months: z.number().int().nullable(),
  }),
  jurisdiction_data_fields: z.array(z.object({ key: z.string(), type: z.string(), options: z.array(z.string()) })),
});
export type ApiRegime = z.infer<typeof apiRegimeSchema>;
export const apiRegimesResponseSchema = z.object({ data: z.array(apiRegimeSchema) });

export const apiOccupancyEntrySchema = z.object({
  unit: apiUnitSchema,
  vacant: z.boolean(),
  since: isoDate.nullable(),
  lease: z
    .object({
      id,
      reference: z.string(),
      phase: leasePhaseSchema.nullable(),
      starts_on: isoDate,
      end_date: isoDate.nullable(),
      tenants: z.array(apiPartySchema),
    })
    .nullable(),
});
export type ApiOccupancyEntry = z.infer<typeof apiOccupancyEntrySchema>;
export const apiOccupancyResponseSchema = z.object({ data: z.array(apiOccupancyEntrySchema) });

export const apiCatalogTermsResponseSchema = z.object({
  data: z.array(
    z.object({
      id,
      semantic_key: z.string().nullable(),
      archived: z.boolean(),
      hidden: z.boolean(),
    }),
  ),
});

export const serverIdSchema = z.guid();

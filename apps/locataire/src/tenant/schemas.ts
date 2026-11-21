import { z } from 'zod';

export const isoDate = z.iso.date();
export const moneySchema = z.object({ amount: z.number().int(), currency: z.string().regex(/^[A-Z]{3}$/) });

export const addressSchema = z.object({
  line1: z.string(),
  line2: z.string().nullish(),
  postal_code: z.string(),
  city: z.string(),
  country: z.string().optional(),
});

const unit = z.object({
  reference: z.string(),
  type: z.string(),
  floor: z.number().int().nullable(),
  surface_hundredths: z.number().int().nonnegative().nullable(),
  property: z.object({ name: z.string(), address: addressSchema }),
});

const organization = z.object({ id: z.uuid(), name: z.string().nullable() });

const summaryFields = {
  id: z.uuid(),
  reference: z.string(),
  regime_key: z.string(),
  status: z.enum(['signed', 'terminated']),
  phase: z.enum(['upcoming', 'running', 'notice', 'ended']),
  starts_on: isoDate,
  end_date: isoDate.nullable(),
  organization,
  main_unit: unit.nullable(),
  access: z.object({ until: isoDate.nullable(), in_grace: z.boolean() }),
};

export const leaseSummarySchema = z.object(summaryFields);
export type ApiLeaseSummary = z.infer<typeof leaseSummarySchema>;

export const leasePageSchema = z.object({
  data: z.array(leaseSummarySchema),
  meta: z.object({ next_cursor: z.string().nullable() }),
});

const period = { valid_from: isoDate, end_date: isoDate.nullable() };

export const leaseDetailSchema = z.object({
  data: z.object({
    ...summaryFields,
    duration_months: z.number().int().positive(),
    tacit_renewal: z.boolean(),
    periodicity: z.string(),
    billing_timing: z.string(),
    due_day: z.number().int().min(1).max(28),
    currency: z.string().regex(/^[A-Z]{3}$/),
    payment_method: z.string().nullable(),
    signed_on: isoDate.nullable(),
    notice: z
      .object({
        received_on: isoDate,
        given_by: z.string().nullable(),
        departure_on: isoDate.nullable(),
      })
      .nullable(),
    units: z.array(z.object({ unit: unit.nullable(), is_main: z.boolean(), ...period })),
    parties: z.array(
      z.object({
        display_name: z.string(),
        role: z.string(),
        is_me: z.boolean(),
        joint_liability: z.boolean(),
        ...period,
      }),
    ),
    terms_on: isoDate,
    terms: z.array(
      z.object({
        component: z.object({ key: z.string(), label: z.string(), semantic_key: z.string().nullable() }).nullable(),
        amount: moneySchema,
        vat_bp: z.number().int().nonnegative(),
        indexed: z.boolean(),
        ...period,
      }),
    ),
  }),
});
export type ApiLeaseDetail = z.infer<typeof leaseDetailSchema>['data'];

export const linksSchema = z.object({
  data: z.array(z.object({ id: z.uuid(), organization })),
});

export const meSchema = z.object({ data: z.object({ name: z.string().trim().min(1), email: z.email() }) });

export const tenantProfileMetaSchema = z.object({ links: z.number().int().nonnegative() });

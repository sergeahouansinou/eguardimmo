import { z } from 'zod';
import { COUNTRY_CODE } from '../lib/country';

const id = z.guid();
const isoDate = z.iso.date();
const timestamp = z.iso.datetime({ offset: true });

export const serverIdSchema = z.guid();

const pageOf = <T extends z.ZodType>(item: T) =>
  z.object({ data: z.array(item), meta: z.object({ next_cursor: z.string().nullable() }) });

export const PROPERTY_TYPES = ['building', 'house', 'complex'] as const;

export const apiAddressSchema = z.object({
  line1: z.string(),
  line2: z.string().nullable().optional(),
  postal_code: z.string(),
  city: z.string(),
  country: z.string().regex(COUNTRY_CODE),
});
export type ApiAddress = z.infer<typeof apiAddressSchema>;

export const apiPropertySummarySchema = z.object({
  id,
  name: z.string(),
  type: z.enum(PROPERTY_TYPES),
  address: apiAddressSchema,
  active_units_count: z.number().int().nonnegative(),
  archived_at: timestamp.nullable(),
});
export type ApiPropertySummary = z.infer<typeof apiPropertySummarySchema>;

const apiTagSchema = z.object({ id, name: z.string(), slug: z.string(), color: z.string().nullable() });

export const apiPropertySchema = apiPropertySummarySchema.extend({
  custom_fields: z.record(z.string(), z.unknown()),
  lock_version: z.number().int().positive(),
  tags: z.array(apiTagSchema),
});
export type ApiProperty = z.infer<typeof apiPropertySchema>;
export const apiPropertyResponseSchema = z.object({ data: apiPropertySchema });
export const apiPropertyPageSchema = pageOf(apiPropertySummarySchema);

export const apiUnitSummarySchema = z.object({
  id,
  property: z.object({ id, name: z.string() }),
  parent_unit_id: id.nullable(),
  unit_type: z.object({ id, key: z.string(), label: z.string(), semantic_key: z.string().nullable() }),
  reference: z.string(),
  floor: z.number().int().nullable(),
  surface_hundredths: z.number().int().positive().nullable(),
  characteristics: z.record(z.string(), z.unknown()),
  custom_fields: z.record(z.string(), z.unknown()),
  lock_version: z.number().int().positive(),
  archived_at: timestamp.nullable(),
});
export type ApiUnit = z.infer<typeof apiUnitSummarySchema>;

export const apiUnitSchema = apiUnitSummarySchema.extend({ tags: z.array(apiTagSchema) });
export const apiUnitResponseSchema = z.object({ data: apiUnitSchema });
export const apiUnitPageSchema = pageOf(apiUnitSummarySchema);

export interface ApiUnitNode extends ApiUnit {
  annexes: ApiUnitNode[];
}
export const apiUnitNodeSchema: z.ZodType<ApiUnitNode> = z.lazy(() => apiUnitSummarySchema.extend({ annexes: z.array(apiUnitNodeSchema) }));
export const apiUnitTreeResponseSchema = z.object({ data: apiUnitNodeSchema });

export const OWNERSHIP_NATURES = ['full', 'bare', 'usufruct'] as const;
export const apiOwnershipSchema = z.object({
  id,
  unit_id: id,
  party_id: id,
  share_bp: z.number().int().positive(),
  nature: z.enum(OWNERSHIP_NATURES),
  valid_from: isoDate,
  valid_to: isoDate.nullable(),
});
export type ApiOwnership = z.infer<typeof apiOwnershipSchema>;
export const apiOwnershipResponseSchema = z.object({ data: apiOwnershipSchema });
export const apiOwnershipsResponseSchema = z.object({ data: z.array(apiOwnershipSchema) });

export const apiUnitTypeTermsResponseSchema = z.object({
  data: z.array(z.object({ id, key: z.string(), semantic_key: z.string().nullable(), archived: z.boolean(), hidden: z.boolean() })),
});

const apiPartySchema = z.object({ id, display_name: z.string(), is_anonymized: z.boolean() });
const apiMoneySchema = z.object({ amount: z.number().int(), currency: z.string().length(3) });

export const LEASE_PHASES = ['draft', 'upcoming', 'running', 'notice', 'ended'] as const;
export const apiLeaseSummarySchema = z.object({
  id,
  reference: z.string(),
  regime_key: z.string(),
  status: z.enum(['draft', 'signed', 'terminated', 'cancelled']),
  phase: z.enum(LEASE_PHASES),
  starts_on: isoDate,
  end_date: isoDate.nullable(),
  currency: z.string().length(3),
  tenants: z.array(apiPartySchema),
});
export type ApiLeaseSummary = z.infer<typeof apiLeaseSummarySchema>;
export const apiLeasePageSchema = pageOf(apiLeaseSummarySchema);

export const apiLeaseDetailSchema = apiLeaseSummarySchema.extend({
  notice: z.object({ departure_on: isoDate.nullable() }).nullable(),
  terms: z.array(
    z.object({
      id,
      component: z.object({ id, semantic_key: z.string().nullable().optional() }),
      amount: apiMoneySchema,
      in_force: z.boolean(),
      valid_from: isoDate,
      reason: z.enum(['initial', 'revision', 'amendment', 'renewal', 'correction']),
    }),
  ),
});
export type ApiLeaseDetail = z.infer<typeof apiLeaseDetailSchema>;
export const apiLeaseDetailResponseSchema = z.object({ data: apiLeaseDetailSchema });

export const apiOccupancyResponseSchema = z.object({
  data: z.array(
    z.object({
      unit: z.object({ id }),
      vacant: z.boolean(),
      since: isoDate.nullable(),
      lease: z
        .object({
          id,
          phase: z.enum(LEASE_PHASES).nullable(),
          starts_on: isoDate,
          end_date: isoDate.nullable(),
          tenants: z.array(apiPartySchema),
        })
        .nullable(),
    }),
  ),
});
export type ApiOccupancy = z.infer<typeof apiOccupancyResponseSchema>['data'][number];

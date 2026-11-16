import { z } from 'zod';

const id = z.guid();
const isoDate = z.iso.date();
const timestamp = z.iso.datetime({ offset: true });

export const PARTY_KINDS = ['person', 'company'] as const;
export const partyKindSchema = z.enum(PARTY_KINDS);
export const LEASE_PHASES = ['draft', 'upcoming', 'running', 'notice', 'ended'] as const;
export const leasePhaseSchema = z.enum(LEASE_PHASES);
export type ApiLeasePhase = z.infer<typeof leasePhaseSchema>;
export const LEASE_ROLES = ['tenant', 'guarantor', 'occupant'] as const;
export const leaseRoleSchema = z.enum(LEASE_ROLES);
export const IDENTIFIER_SCHEMES = ['siren', 'siret', 'vat', 'neq', 'bce', 'rcs_lu', 'national_id', 'passport', 'residence_permit', 'tax_id'] as const;
export const identifierSchemeSchema = z.enum(IDENTIFIER_SCHEMES);
export type IdentifierScheme = z.infer<typeof identifierSchemeSchema>;
export const CONTACT_POINT_TYPES = ['email', 'phone'] as const;
export const contactPointTypeSchema = z.enum(CONTACT_POINT_TYPES);
export type ContactPointType = z.infer<typeof contactPointTypeSchema>;

const pageMeta = z.object({ per_page: z.number().int().nonnegative(), next_cursor: z.string().nullable() });

export const apiPartySummarySchema = z.object({
  id,
  kind: partyKindSchema,
  display_name: z.string(),
  primary_email: z.string().nullable(),
  primary_phone: z.string().nullable(),
  is_anonymized: z.boolean(),
  archived_at: timestamp.nullable(),
});
export type ApiPartySummary = z.infer<typeof apiPartySummarySchema>;

export const apiPartyPageSchema = z.object({ data: z.array(apiPartySummarySchema), meta: pageMeta });

export const apiContactPointSchema = z.object({
  id,
  type: contactPointTypeSchema,
  value: z.string(),
  label: z.string().nullable(),
  is_primary: z.boolean(),
});
export type ApiContactPoint = z.infer<typeof apiContactPointSchema>;

export const apiIdentifierSchema = z.object({
  id,
  scheme: identifierSchemeSchema,
  country: z.string(),
  value: z.string().nullable(),
  last4: z.string().nullable(),
});
export type ApiIdentifier = z.infer<typeof apiIdentifierSchema>;

export const apiBankAccountSchema = z.object({
  id,
  iban_last4: z.string(),
  bic: z.string().nullable(),
  holder_name: z.string(),
  valid_from: isoDate,
  valid_to: isoDate.nullable(),
  is_active: z.boolean(),
});
export type ApiBankAccount = z.infer<typeof apiBankAccountSchema>;

export const apiAddressSchema = z.object({
  line1: z.string(),
  line2: z.string().nullish(),
  postal_code: z.string(),
  city: z.string(),
  country: z.string(),
});
export type ApiAddress = z.infer<typeof apiAddressSchema>;

export const apiPartySchema = z.object({
  id,
  kind: partyKindSchema,
  display_name: z.string(),
  last_name: z.string().nullable(),
  first_name: z.string().nullable(),
  company_name: z.string().nullable(),
  legal_form_term_id: id.nullable(),
  birth_date: isoDate.nullable(),
  address: apiAddressSchema.nullable(),
  language: z.string(),
  has_account: z.boolean(),
  custom_fields: z.record(z.string(), z.unknown()),
  lock_version: z.number().int().positive(),
  is_anonymized: z.boolean(),
  anonymized_at: timestamp.nullable(),
  archived_at: timestamp.nullable(),
  categories: z.array(z.object({ id, key: z.string(), label: z.string(), semantic_key: z.string().nullable() })),
  tags: z.array(z.object({ id, name: z.string(), slug: z.string(), color: z.string().nullable() })),
  contact_points: z.array(apiContactPointSchema),
  identifiers: z.array(apiIdentifierSchema),
  bank_accounts: z.array(apiBankAccountSchema),
});
export type ApiParty = z.infer<typeof apiPartySchema>;

export const apiPartyResponseSchema = z.object({ data: apiPartySchema });
export const apiContactPointResponseSchema = z.object({ data: apiContactPointSchema });
export const apiIdentifierResponseSchema = z.object({ data: apiIdentifierSchema });
export const apiBankAccountResponseSchema = z.object({ data: apiBankAccountSchema });

const apiUnitRefSchema = z.object({ id, reference: z.string(), property: z.object({ id, name: z.string() }) });
export type ApiUnitRef = z.infer<typeof apiUnitRefSchema>;

export const apiTenancyLineSchema = z.object({
  id,
  reference: z.string(),
  role: leaseRoleSchema,
  phase: leasePhaseSchema,
  main_unit: apiUnitRefSchema.nullable(),
  since: isoDate,
  end_date: isoDate.nullable(),
});
export type ApiTenancyLine = z.infer<typeof apiTenancyLineSchema>;

export const apiTenancySchema = z.object({
  party: z.object({ id, display_name: z.string(), kind: partyKindSchema, is_anonymized: z.boolean() }),
  leases: z.array(apiTenancyLineSchema),
});
export type ApiTenancy = z.infer<typeof apiTenancySchema>;
export const apiTenanciesResponseSchema = z.object({ data: z.array(apiTenancySchema) });

export const apiUnitPageSchema = z.object({ data: z.array(apiUnitRefSchema), meta: pageMeta });
export const apiOccupancyResponseSchema = z.object({ data: z.array(z.object({ unit: z.object({ id }), vacant: z.boolean() })) });

const apiMoneySchema = z.object({ amount: z.number().int(), currency: z.string().length(3) });

export const apiLeaseDetailSchema = z.object({
  id,
  reference: z.string(),
  currency: z.string().length(3),
  end_date: isoDate.nullable(),
  terms: z.array(z.object({ component: z.object({ semantic_key: z.string().nullable().optional() }), amount: apiMoneySchema, in_force: z.boolean() })),
  parties: z.array(
    z.object({
      id,
      party: z.object({ id, display_name: z.string() }),
      role: leaseRoleSchema,
      guarantees_party_id: id.nullable(),
      end_date: isoDate.nullable(),
    }),
  ),
});
export type ApiLeaseDetail = z.infer<typeof apiLeaseDetailSchema>;
export const apiLeaseDetailResponseSchema = z.object({ data: apiLeaseDetailSchema });

export const apiTermListSchema = z.object({ data: z.array(z.object({ id, archived: z.boolean() })) });
export const apiOrganizationResponseSchema = z.object({ data: z.object({ country: z.string().regex(/^[A-Z]{2}$/) }) });

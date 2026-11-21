import type { ApiClient } from '@eguardimmo/api';
import { z } from 'zod';
import { CONSOLE_ROOT, cursorParams, dataOf, dateTime, filled, listOf, parse, read, segment } from '../transport';
import type { CursorPage, CursorQuery } from '../transport';

export const ORGANISATION_KINDS = ['agency', 'individual'] as const;
export type OrganisationKind = (typeof ORGANISATION_KINDS)[number];
export const ORGANISATION_STATES = ['active', 'suspended'] as const;
export type OrganisationState = (typeof ORGANISATION_STATES)[number];
export const ORGANISATION_SUSPENSION_REASONS = ['fraud', 'abuse', 'legal_order', 'security'] as const;
export type OrganisationSuspensionReason = (typeof ORGANISATION_SUSPENSION_REASONS)[number];

const organisationSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  kind: z.enum(ORGANISATION_KINDS),
  country: z.string(),
  created_at: dateTime,
  state: z.enum(ORGANISATION_STATES),
  suspension: z.object({ suspended_at: dateTime, reason: z.string().nullable() }).nullable(),
  members_count: z.number().int().nonnegative(),
  plan: z.string().nullable(),
  subscription_status: z.string().nullable(),
  two_factor_required: z.boolean().optional(),
  owner: z.object({ first_name: z.string(), last_name: z.string(), account_id: z.string().nullable() }).nullable().optional(),
});

const listSchema = listOf(organisationSchema, {});

export interface Organisation {
  id: string;
  name: string;
  kind: OrganisationKind;
  country: string;
  createdAt: string;
  state: OrganisationState;
  suspension: { suspendedAt: string; reason: string | null } | null;
  membersCount: number;
  plan: string | null;
  subscriptionStatus: string | null;
  twoFactorRequired: boolean | null;
  owner: { firstName: string; lastName: string; accountId: string | null } | null;
}

export interface OrganisationQuery extends CursorQuery {
  kind?: OrganisationKind;
  state?: OrganisationState;
  search?: string;
  plan?: string;
  subscriptionStatus?: string;
}

export const SEARCH_MIN_LENGTH = 3;

export function toOrganisation(raw: z.infer<typeof organisationSchema>): Organisation {
  return {
    id: raw.id,
    name: raw.name,
    kind: raw.kind,
    country: raw.country,
    createdAt: raw.created_at,
    state: raw.state,
    suspension: raw.suspension === null ? null : { suspendedAt: raw.suspension.suspended_at, reason: raw.suspension.reason },
    membersCount: raw.members_count,
    plan: raw.plan,
    subscriptionStatus: raw.subscription_status,
    twoFactorRequired: raw.two_factor_required ?? null,
    owner: raw.owner ? { firstName: raw.owner.first_name, lastName: raw.owner.last_name, accountId: raw.owner.account_id } : null,
  };
}

export interface OrganisationsApi {
  list: (query?: OrganisationQuery) => Promise<CursorPage<Organisation>>;
  get: (id: string) => Promise<Organisation>;
}

export function organisationsApi(client: ApiClient): OrganisationsApi {
  return {
    list: async (query = {}) => {
      const search = filled(query.search);
      const { data, meta } = parse(
        listSchema,
        await client.get(`${CONSOLE_ROOT}/organizations`, {
          ...cursorParams(query),
          kind: query.kind,
          state: query.state,
          search: search !== undefined && search.length >= SEARCH_MIN_LENGTH ? search : undefined,
          plan: filled(query.plan),
          subscription_status: filled(query.subscriptionStatus),
        }),
      );
      return { rows: data.map(toOrganisation), hasMore: meta.has_more, nextCursor: meta.next_cursor };
    },
    get: async (id) => toOrganisation((await read(client, `/organizations/${segment(id)}`, dataOf(organisationSchema))).data),
  };
}

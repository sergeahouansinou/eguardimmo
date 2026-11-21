import type { ApiClient } from '@eguardimmo/api';
import { z } from 'zod';
import { CONSOLE_ROOT, cursorParams, dataOf, dateTime, filled, flag, listOf, nullableDateTime, parse, read, segment } from '../transport';
import type { CursorPage, CursorQuery } from '../transport';

export const SUBSCRIPTION_STATUSES = ['trialing', 'free', 'active', 'past_due', 'cancelling', 'ended'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

const subscriptionSchema = z.object({
  id: z.string().min(1),
  organization_id: z.string().min(1),
  plan: z.string(),
  plan_version: z.number().int().positive(),
  status: z.enum(SUBSCRIPTION_STATUSES),
  currency: z.string().nullable(),
  trial_ends_at: nullableDateTime,
  current_period_end: nullableDateTime,
  created_at: dateTime,
});

const listSchema = listOf(subscriptionSchema, {});

export interface SubscriptionRow {
  id: string;
  organizationId: string;
  plan: string;
  planVersion: number;
  status: SubscriptionStatus;
  currency: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  createdAt: string;
}

export interface SubscriptionQuery extends CursorQuery {
  status?: SubscriptionStatus;
  plan?: string;
  trialEnding?: boolean;
}

const entitlementViewSchema = z.object({
  feature: z.string().min(1),
  label: z.string(),
  group: z.string(),
  kind: z.enum(['quota', 'function']),
  enabled: z.boolean(),
  limit: z.number().int().nonnegative().nullable(),
  source: z.string().nullable(),
});

const overrideSchema = z.object({
  id: z.string().min(1),
  feature: z.string().min(1),
  enabled: z.boolean(),
  limit: z.number().int().nonnegative().nullable(),
  starts_at: dateTime,
  ends_at: dateTime,
  reason_code: z.string(),
  revoked_at: nullableDateTime,
});

const organisationEntitlementsSchema = z.object({
  organization_id: z.string().min(1),
  subscription: z.object({
    plan: z.string(),
    plan_version: z.number().int().positive(),
    status: z.string(),
    trial_ends_at: nullableDateTime,
    currency: z.string().nullable(),
  }),
  entitlements: z.array(entitlementViewSchema),
  overrides: z.array(overrideSchema),
});

export interface EntitlementOverride {
  id: string;
  feature: string;
  enabled: boolean;
  limit: number | null;
  startsAt: string;
  endsAt: string;
  reasonCode: string;
  revokedAt: string | null;
}

export interface OrganisationEntitlements {
  organizationId: string;
  subscription: { plan: string; planVersion: number; status: string; trialEndsAt: string | null; currency: string | null };
  entitlements: { feature: string; label: string; group: string; kind: 'quota' | 'function'; enabled: boolean; limit: number | null; source: string | null }[];
  overrides: EntitlementOverride[];
}

export interface SubscriptionsApi {
  list: (query?: SubscriptionQuery) => Promise<CursorPage<SubscriptionRow>>;
  organisationEntitlements: (organisationId: string) => Promise<OrganisationEntitlements>;
}

export function subscriptionsApi(client: ApiClient): SubscriptionsApi {
  return {
    list: async (query = {}) => {
      const { data, meta } = parse(
        listSchema,
        await client.get(`${CONSOLE_ROOT}/subscriptions`, { ...cursorParams(query), status: query.status, plan: filled(query.plan), trial_ending: flag(query.trialEnding) }),
      );
      return {
        rows: data.map((raw) => ({
          id: raw.id,
          organizationId: raw.organization_id,
          plan: raw.plan,
          planVersion: raw.plan_version,
          status: raw.status,
          currency: raw.currency,
          trialEndsAt: raw.trial_ends_at,
          currentPeriodEnd: raw.current_period_end,
          createdAt: raw.created_at,
        })),
        hasMore: meta.has_more,
        nextCursor: meta.next_cursor,
      };
    },
    organisationEntitlements: async (organisationId) => {
      const { data } = await read(client, `/organizations/${segment(organisationId)}/entitlements`, dataOf(organisationEntitlementsSchema));
      return {
        organizationId: data.organization_id,
        subscription: {
          plan: data.subscription.plan,
          planVersion: data.subscription.plan_version,
          status: data.subscription.status,
          trialEndsAt: data.subscription.trial_ends_at,
          currency: data.subscription.currency,
        },
        entitlements: data.entitlements,
        overrides: data.overrides.map((o) => ({ id: o.id, feature: o.feature, enabled: o.enabled, limit: o.limit, startsAt: o.starts_at, endsAt: o.ends_at, reasonCode: o.reason_code, revokedAt: o.revoked_at })),
      };
    },
  };
}

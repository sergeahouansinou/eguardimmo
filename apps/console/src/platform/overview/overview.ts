import type { ApiClient } from '@eguardimmo/api';
import { z } from 'zod';
import { count, dataOf, dateTime, read } from '../transport';

const countMap = z.union([z.record(z.string(), count), z.array(z.never()).length(0)]);

const schema = dataOf(
  z.object({
    generated_at: dateTime,
    organizations: z.object({ total: count, agencies: count, individuals: count, suspended: count, created_30d: count }).optional(),
    user_accounts: z.object({ total: count, suspended: count, suspension_to_review: count, created_30d: count }).optional(),
    subscriptions: z.object({ by_status: countMap, by_plan: countMap, trials_ending_7d: count }).optional(),
    support: z.object({ open_total: count, awaiting_support: count, awaiting_requester: count, unassigned: count }).optional(),
    privacy: z.object({ open_total: count, overdue: count, due_within_7d: count }).optional(),
  }),
);

export interface Overview {
  generatedAt: string;
  organizations: { total: number; agencies: number; individuals: number; suspended: number; created30d: number } | null;
  accounts: { total: number; suspended: number; suspensionToReview: number; created30d: number } | null;
  subscriptions: { byStatus: { key: string; total: number }[]; byPlan: { key: string; total: number }[]; trialsEnding7d: number } | null;
  support: { openTotal: number; awaitingSupport: number; awaitingRequester: number; unassigned: number } | null;
  privacy: { openTotal: number; overdue: number; dueWithin7d: number } | null;
}

const entries = (map: z.infer<typeof countMap>) => (Array.isArray(map) ? [] : Object.entries(map).map(([key, total]) => ({ key, total })));

export async function fetchOverview(client: ApiClient): Promise<Overview> {
  const { data } = await read(client, '/overview', schema);
  return {
    generatedAt: data.generated_at,
    organizations: data.organizations
      ? { total: data.organizations.total, agencies: data.organizations.agencies, individuals: data.organizations.individuals, suspended: data.organizations.suspended, created30d: data.organizations.created_30d }
      : null,
    accounts: data.user_accounts
      ? { total: data.user_accounts.total, suspended: data.user_accounts.suspended, suspensionToReview: data.user_accounts.suspension_to_review, created30d: data.user_accounts.created_30d }
      : null,
    subscriptions: data.subscriptions
      ? { byStatus: entries(data.subscriptions.by_status), byPlan: entries(data.subscriptions.by_plan), trialsEnding7d: data.subscriptions.trials_ending_7d }
      : null,
    support: data.support
      ? { openTotal: data.support.open_total, awaitingSupport: data.support.awaiting_support, awaitingRequester: data.support.awaiting_requester, unassigned: data.support.unassigned }
      : null,
    privacy: data.privacy ? { openTotal: data.privacy.open_total, overdue: data.privacy.overdue, dueWithin7d: data.privacy.due_within_7d } : null,
  };
}

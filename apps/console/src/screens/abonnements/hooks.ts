'use client';

import { usePlatformMutation, usePlatformQuery } from '@/platform/context';
import type { PlatformQuery } from '@/platform/context';
import type { Plan, PlanVersionChanges } from '@/platform/plans/plans';
import type { CursorPage } from '@/platform/transport';
import type { SubscriptionQuery, SubscriptionRow } from '@/platform/plans/subscriptions';

export const usePlans = (): PlatformQuery<Plan[]> => usePlatformQuery(['plans', 'list'], (api) => api.plans.list());

export const usePlan = (code: string): PlatformQuery<Plan> => usePlatformQuery(['plans', 'detail', code], (api) => api.plans.get(code));

export const useSubscriptions = (query: SubscriptionQuery): PlatformQuery<CursorPage<SubscriptionRow>> =>
  usePlatformQuery(['subscriptions', 'list', query], (api) => api.subscriptions.list(query), { keepPrevious: true });

export const useCreateDraft = () => usePlatformMutation((api, code: string) => api.plans.createDraft(code));

export const useUpdateDraft = () =>
  usePlatformMutation((api, input: { versionId: string; changes: PlanVersionChanges }) => api.plans.updateDraft(input.versionId, input.changes));

'use client';

import { TENANT_REQUESTS_ROOT, useGuardedQuery, useScopedMutation } from '../shared/hooks';
import type { LeaseNoticeInput, NoticeQuery } from './model';
import { useNoticesSource } from './source';

export const noticeKeys = {
  list: (query: NoticeQuery) => ['notices', query] as const,
  one: (id: string) => ['notice', id] as const,
};

export { TENANT_REQUESTS_ROOT };

export function useNoticeRequests(query: NoticeQuery) {
  const source = useNoticesSource();
  return useGuardedQuery(noticeKeys.list(query), () => source.list(query));
}

export function useNoticeRequest(id: string) {
  const source = useNoticesSource();
  return useGuardedQuery(noticeKeys.one(id), () => source.get(id));
}

export function useAcknowledgeNotice() {
  const source = useNoticesSource();
  return useScopedMutation(({ id, receivedOn }: { id: string; receivedOn: string }) => source.acknowledge(id, receivedOn));
}

export function useRecordLeaseNotice() {
  const source = useNoticesSource();
  return useScopedMutation(({ leaseId, lockVersion, requestId, input }: { leaseId: string; lockVersion: number; requestId: string; input: LeaseNoticeInput }) =>
    source.recordLeaseNotice(leaseId, lockVersion, requestId, input));
}

export function useEndParticipant() {
  const source = useNoticesSource();
  return useScopedMutation(({ leaseId, linkId, lockVersion, requestId, validTo }: { leaseId: string; linkId: string; lockVersion: number; requestId: string; validTo: string }) =>
    source.endParticipant(leaseId, linkId, lockVersion, requestId, validTo));
}

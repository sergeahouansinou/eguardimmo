'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { saveBlob } from './download';
import { tenantKeys } from './keys';
import { fetchLetter, fetchNoticeOptions, fetchNoticeRequestsPage, noticeLetterPath, submitNotice, withdrawNotice } from './noticeRequests';
import type { NoticeInput } from './noticeRequests';
import { useTenantSession } from './session';

export function useNoticeOptions(leaseId: string) {
  const { client } = useTenantSession();
  return useQuery({ queryKey: tenantKeys.noticeOptions(leaseId), queryFn: () => fetchNoticeOptions(client, leaseId) });
}

export function useNoticeRequests() {
  const { client } = useTenantSession();
  return useInfiniteQuery({
    queryKey: tenantKeys.noticeRequests,
    queryFn: ({ pageParam }) => fetchNoticeRequestsPage(client, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
}

function useRefreshNotice() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: tenantKeys.noticeRequests }),
      queryClient.invalidateQueries({ queryKey: ['tenant', 'notice', 'options'] }),
    ]);
}

export function useSubmitNotice() {
  const { client } = useTenantSession();
  const refresh = useRefreshNotice();
  return useMutation({ mutationFn: (input: NoticeInput) => submitNotice(client, input), onSuccess: refresh });
}

export function useWithdrawNotice() {
  const { client } = useTenantSession();
  const refresh = useRefreshNotice();
  return useMutation({ mutationFn: (id: string) => withdrawNotice(client, id), onSettled: refresh });
}

export function useLetterDownload() {
  const { client } = useTenantSession();
  return useMutation({
    mutationFn: async ({ id, filename }: { id: string; filename: string }) => {
      saveBlob(await fetchLetter(client, noticeLetterPath(id)), filename);
    },
  });
}

'use client';

import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { saveBlob } from './download';
import { fetchDocumentFile, fetchLeaseDocumentsPage } from './documentRequests';
import { tenantKeys } from './keys';
import { useTenantSession } from './session';

export function useLeaseDocuments(leaseId: string) {
  const { client } = useTenantSession();
  return useInfiniteQuery({
    queryKey: tenantKeys.leaseDocuments(leaseId),
    queryFn: ({ pageParam }) => fetchLeaseDocumentsPage(client, leaseId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
}

export interface FileRequest {
  path: string;
  filename: string;
}

export function useFileDownload() {
  const { client } = useTenantSession();
  return useMutation({
    mutationFn: async ({ path, filename }: FileRequest) => {
      saveBlob(await fetchDocumentFile(client, path), filename);
    },
  });
}

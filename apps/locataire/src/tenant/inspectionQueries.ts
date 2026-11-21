'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { saveBlob } from './download';
import { createRemark, fetchInspection, fetchInspectionBlob, fetchInspectionsPage, fetchRemarksPage } from './inspectionRequests';
import type { RemarkInput } from './inspectionRequests';
import { tenantKeys } from './keys';
import { useTenantSession } from './session';

export function useInspections() {
  const { client } = useTenantSession();
  return useInfiniteQuery({
    queryKey: tenantKeys.inspections,
    queryFn: ({ pageParam }) => fetchInspectionsPage(client, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
}

export function useInspection(id: string) {
  const { client } = useTenantSession();
  return useQuery({ queryKey: tenantKeys.inspection(id), queryFn: () => fetchInspection(client, id) });
}

export function useRemarks(id: string) {
  const { client } = useTenantSession();
  return useInfiniteQuery({
    queryKey: tenantKeys.inspectionRemarks(id),
    queryFn: ({ pageParam }) => fetchRemarksPage(client, id, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
}

export function useCreateRemark() {
  const { client } = useTenantSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RemarkInput) => createRemark(client, input),
    onSuccess: (_remark, input) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: tenantKeys.inspectionRemarks(input.inspectionId) }),
        queryClient.invalidateQueries({ queryKey: tenantKeys.inspection(input.inspectionId) }),
      ]),
  });
}

const INSPECTION_FILE_TYPES = ['application/pdf', 'image/'] as const;

export function useInspectionDownload() {
  const { client } = useTenantSession();
  return useMutation({
    mutationFn: async ({ path, filename }: { path: string; filename: string }) => {
      saveBlob(await fetchInspectionBlob(client, path, INSPECTION_FILE_TYPES), filename);
    },
  });
}

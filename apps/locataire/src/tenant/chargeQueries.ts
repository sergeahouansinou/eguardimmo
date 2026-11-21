'use client';

import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { fetchChargeFile, fetchChargePdf, fetchChargeStatement, fetchChargeStatementsPage } from './chargeRequests';
import { saveBlob } from './download';
import { fileExtension } from './chargeLabels';
import { tenantKeys } from './keys';
import { useTenantSession } from './session';

export function useChargeStatements(leaseId: string | null) {
  const { client } = useTenantSession();
  return useInfiniteQuery({
    queryKey: tenantKeys.chargeStatements(leaseId),
    queryFn: ({ pageParam }) => fetchChargeStatementsPage(client, leaseId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
}

export function useChargeStatement(id: string) {
  const { client } = useTenantSession();
  return useQuery({ queryKey: tenantKeys.chargeStatement(id), queryFn: () => fetchChargeStatement(client, id) });
}

export interface ChargeDownload {
  kind: 'pdf' | 'file';
  path: string;
  baseName: string;
}

export function useChargeDownload() {
  const { client } = useTenantSession();
  return useMutation({
    mutationFn: async ({ kind, path, baseName }: ChargeDownload) => {
      const blob = await (kind === 'pdf' ? fetchChargePdf(client, path) : fetchChargeFile(client, path));
      saveBlob(blob, `${baseName}.${fileExtension(blob.type)}`);
    },
  });
}

'use client';

import { useAfterHydration } from '@eguardimmo/shell';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Certificate, CertificateQuery, NewCertificateInput, RenewCertificateInput } from './model';
import { useConformiteSource } from './source';

export const CONFORMITE_ROOT = ['gestion', 'conformite'] as const;

export const conformiteKeys = {
  types: () => [...CONFORMITE_ROOT, 'types'] as const,
  certificates: (query: CertificateQuery) => [...CONFORMITE_ROOT, 'certificates', query] as const,
  certificate: (id: string) => [...CONFORMITE_ROOT, 'certificate', id] as const,
};

export interface ConformiteQuery<T> {
  data: T | undefined;
  isError: boolean;
  isPending: boolean;
  error: Error | null;
}

function useConformiteQuery<T>(key: readonly unknown[], load: () => Promise<T>): ConformiteQuery<T> {
  const query = useQuery({ queryKey: key, queryFn: load, retry: false });
  const settled = useAfterHydration(query);
  return { ...settled, error: settled.isError ? query.error : null };
}

export const useConformitePermissions = () => useConformiteSource().permissions;

export function useCertificateTypes() {
  const source = useConformiteSource();
  return useConformiteQuery(conformiteKeys.types(), () => source.certificateTypes());
}

export function useCertificates(query: CertificateQuery) {
  const source = useConformiteSource();
  return useConformiteQuery(conformiteKeys.certificates(query), () => source.certificates(query));
}

export function useCertificate(id: string) {
  const source = useConformiteSource();
  return useConformiteQuery(conformiteKeys.certificate(id), () => source.certificate(id));
}

function useConformiteMutation<I, O>(run: (input: I) => Promise<O>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => client.invalidateQueries({ queryKey: CONFORMITE_ROOT }),
  });
}

export function useCreateCertificate() {
  const source = useConformiteSource();
  return useConformiteMutation((input: NewCertificateInput) => source.createCertificate(input));
}

export function useRenewCertificate() {
  const source = useConformiteSource();
  return useConformiteMutation(({ current, input }: { current: Certificate; input: RenewCertificateInput }) => source.renewCertificate(current, input));
}

export function useFileDownload() {
  const source = useConformiteSource();
  return useMutation({ mutationFn: (fileId: string) => source.downloadFile(fileId) });
}

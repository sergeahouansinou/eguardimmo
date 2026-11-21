'use client';

import { useAfterHydration } from '@eguardimmo/shell';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InterventionQuery, QuoteQuery, SupplierQuery } from './model';
import { useMaintenanceSource } from './source';
import type { MaintenanceSource } from './source';

export const MAINTENANCE_ROOT = ['gestion', 'maintenance'] as const;

export const maintenanceKeys = {
  interventions: (query: InterventionQuery) => [...MAINTENANCE_ROOT, 'interventions', query] as const,
  intervention: (id: string) => [...MAINTENANCE_ROOT, 'intervention', id] as const,
  quotes: (query: QuoteQuery) => [...MAINTENANCE_ROOT, 'quotes', query] as const,
  supplierChoices: [...MAINTENANCE_ROOT, 'supplier-choices'] as const,
  suppliers: (query: SupplierQuery) => [...MAINTENANCE_ROOT, 'suppliers', query] as const,
  units: (search: string) => [...MAINTENANCE_ROOT, 'units', search] as const,
  parties: [...MAINTENANCE_ROOT, 'parties'] as const,
  natureTerms: [...MAINTENANCE_ROOT, 'nature-terms'] as const,
  taxRates: [...MAINTENANCE_ROOT, 'tax-rates'] as const,
};

export interface MaintenanceQuery<T> {
  data: T | undefined;
  isError: boolean;
  isPending: boolean;
  error: Error | null;
}

function useMaintenanceQuery<T>(key: readonly unknown[], load: () => Promise<T>, enabled = true): MaintenanceQuery<T> {
  const query = useQuery({ queryKey: key, queryFn: load, enabled, retry: false });
  const settled = useAfterHydration(query);
  return { ...settled, error: settled.isError ? query.error : null };
}

export const useMaintenancePermissions = () => useMaintenanceSource().permissions;

export function useInterventions(query: InterventionQuery) {
  const source = useMaintenanceSource();
  return useMaintenanceQuery(maintenanceKeys.interventions(query), () => source.interventions(query));
}

export function useIntervention(id: string) {
  const source = useMaintenanceSource();
  return useMaintenanceQuery(maintenanceKeys.intervention(id), () => source.intervention(id));
}

export function useSuppliers(query: SupplierQuery) {
  const source = useMaintenanceSource();
  return useMaintenanceQuery(maintenanceKeys.suppliers(query), () => source.suppliers(query));
}

export function useQuotes(query: Omit<QuoteQuery, 'cursor'>) {
  const source = useMaintenanceSource();
  return useInfiniteQuery({
    queryKey: maintenanceKeys.quotes(query),
    queryFn: ({ pageParam }) => source.quotes({ ...query, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    retry: false,
  });
}

const REFERENCE_STALE_MS = 60_000;

export function useUnitChoices(search: string, enabled = true) {
  const source = useMaintenanceSource();
  return useQuery({ queryKey: maintenanceKeys.units(search), queryFn: () => source.units(search), retry: false, staleTime: REFERENCE_STALE_MS, enabled: enabled && source.permissions.available });
}

export function usePartyChoices(enabled = true) {
  const source = useMaintenanceSource();
  return useQuery({ queryKey: maintenanceKeys.parties, queryFn: () => source.parties(), retry: false, staleTime: REFERENCE_STALE_MS, enabled: enabled && source.permissions.available });
}

export function useNatureTerms() {
  const source = useMaintenanceSource();
  return useQuery({ queryKey: maintenanceKeys.natureTerms, queryFn: () => source.natureTerms(), retry: false, staleTime: REFERENCE_STALE_MS, enabled: source.permissions.available });
}

export function useTaxRates(enabled = true) {
  const source = useMaintenanceSource();
  return useQuery({ queryKey: maintenanceKeys.taxRates, queryFn: () => source.taxRates(), retry: false, staleTime: REFERENCE_STALE_MS, enabled: enabled && source.permissions.available });
}

export function useMaintenanceMutation<I, O>(run: (source: MaintenanceSource, input: I) => Promise<O>) {
  const source = useMaintenanceSource();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: I) => run(source, input),
    onSuccess: () => client.invalidateQueries({ queryKey: MAINTENANCE_ROOT }),
  });
}

export function useRefreshOnStale() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: MAINTENANCE_ROOT });
}

export function useFileDownload() {
  const source = useMaintenanceSource();
  return useMutation({ mutationFn: ({ id, fileId }: { id: string; fileId: string }) => source.downloadFile(id, fileId) });
}

export function useSupplierChoices() {
  const source = useMaintenanceSource();
  return useQuery({ queryKey: maintenanceKeys.supplierChoices, queryFn: () => source.supplierChoices(), retry: false, staleTime: REFERENCE_STALE_MS, enabled: source.permissions.available });
}

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ORG_ROOT, useOrgQuery } from '../orgapi/hooks';
import { useOrgInfoSource } from '../orgapi/source';
import type { AssumptionsInput, ExportRequest, Period } from './model';
import { useAnalyticsSource } from './source';

export const ANALYTICS_ROOT = ['gestion', 'analytics'] as const;

export function useRevenueExpenses(period: Period | null) {
  const source = useAnalyticsSource();
  const { organizationId } = useOrgInfoSource();
  return useOrgQuery([...ANALYTICS_ROOT, 'revenue', organizationId, period], () => (period === null ? Promise.reject(new Error('Période absente.')) : source.revenueExpenses(period)), { enabled: period !== null });
}

export function useOccupancy(period: Period | null) {
  const source = useAnalyticsSource();
  const { organizationId } = useOrgInfoSource();
  return useOrgQuery([...ANALYTICS_ROOT, 'occupancy', organizationId, period], () => (period === null ? Promise.reject(new Error('Période absente.')) : source.occupancy(period)), { enabled: period !== null });
}

export function useProfitability(year: number, enabled = true) {
  const source = useAnalyticsSource();
  const { organizationId } = useOrgInfoSource();
  return useOrgQuery([...ANALYTICS_ROOT, 'profitability', organizationId, year], () => source.profitability(year), { enabled });
}

export function useForecast() {
  const source = useAnalyticsSource();
  const { organizationId } = useOrgInfoSource();
  return useOrgQuery([...ANALYTICS_ROOT, 'forecast', organizationId], () => source.forecast());
}

export function useSaveAssumptions() {
  const source = useAnalyticsSource();
  const client = useQueryClient();
  return useMutation({ mutationFn: (input: AssumptionsInput) => source.saveAssumptions(input), onSettled: () => client.invalidateQueries({ queryKey: [...ANALYTICS_ROOT, 'forecast'] }) });
}

export function useExportCsv() {
  const source = useAnalyticsSource();
  return useMutation({ mutationFn: (request: ExportRequest) => source.exportCsv(request) });
}

export function useAnalyticsRetry(): () => void {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: ANALYTICS_ROOT });
    void client.invalidateQueries({ queryKey: ORG_ROOT });
  };
}

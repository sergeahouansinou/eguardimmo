'use client';

import { useAfterHydration } from '@eguardimmo/shell';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateReportsInput, ReportChanges, ReportQuery } from './model';
import { useReportingSource } from './source';

export const REPORTING_ROOT = ['gestion', 'reporting'] as const;
const PARTY_ROOT = ['gestion', 'reporting-parties'] as const;

export const reportingKeys = {
  agencyKpis: (month?: string) => [...REPORTING_ROOT, 'agency-kpis', month ?? null] as const,
  agencyPayouts: () => [...REPORTING_ROOT, 'agency-payouts'] as const,
  agencyAlerts: () => [...REPORTING_ROOT, 'agency-alerts'] as const,
  landlordHome: (month?: string) => [...REPORTING_ROOT, 'landlord', month ?? null] as const,
  aging: () => [...REPORTING_ROOT, 'aging'] as const,
  reports: (query: ReportQuery) => [...REPORTING_ROOT, 'reports', query] as const,
  report: (id: string) => [...REPORTING_ROOT, 'report', id] as const,
  mandants: () => [...REPORTING_ROOT, 'mandants'] as const,
  statement: (mandantId: string, from: string, to: string) => [...REPORTING_ROOT, 'statement', mandantId, from, to] as const,
  party: (id: string) => [...PARTY_ROOT, id] as const,
};

export interface ReportingQuery<T> {
  data: T | undefined;
  isError: boolean;
  isPending: boolean;
  error: Error | null;
}

function useReportingQuery<T>(key: readonly unknown[], load: () => Promise<T>, enabled = true): ReportingQuery<T> {
  const query = useQuery({ queryKey: key, queryFn: load, enabled, retry: false, gcTime: 0, staleTime: 0 });
  const settled = useAfterHydration(query);
  return { ...settled, error: settled.isError ? query.error : null };
}

export const useReportingPermissions = () => useReportingSource().permissions;

export function useAgencyKpis(month?: string) {
  const source = useReportingSource();
  return useReportingQuery(reportingKeys.agencyKpis(month), () => source.agencyKpis(month));
}

export function useAgencyPayouts() {
  const source = useReportingSource();
  return useReportingQuery(reportingKeys.agencyPayouts(), () => source.agencyPayouts());
}

export function useAgencyAlerts() {
  const source = useReportingSource();
  return useReportingQuery(reportingKeys.agencyAlerts(), () => source.agencyAlerts());
}

export function useLandlordHome(month?: string) {
  const source = useReportingSource();
  return useReportingQuery(reportingKeys.landlordHome(month), () => source.landlordHome(month));
}

export function useAging() {
  const source = useReportingSource();
  return useReportingQuery(reportingKeys.aging(), () => source.aging());
}

export function useReports(query: ReportQuery) {
  const source = useReportingSource();
  return useReportingQuery(reportingKeys.reports(query), () => source.reports(query));
}

export function useReport(id: string) {
  const source = useReportingSource();
  return useReportingQuery(reportingKeys.report(id), () => source.report(id));
}

export function useMandants(enabled = true) {
  const source = useReportingSource();
  return useReportingQuery(reportingKeys.mandants(), () => source.mandants(), enabled);
}

export function useStatement(mandantId: string | null, from: string | null, to: string | null) {
  const source = useReportingSource();
  const ready = mandantId !== null && from !== null && to !== null;
  return useReportingQuery(reportingKeys.statement(mandantId ?? '', from ?? '', to ?? ''), () => source.statement(mandantId ?? '', from ?? '', to ?? ''), ready);
}

export type PartyNames = (id: string, known?: string | null) => string;

export function usePartyNames(ids: readonly string[]): PartyNames {
  const source = useReportingSource();
  const unique = [...new Set(ids)];
  const results = useQueries({
    queries: unique.map((id) => ({ queryKey: reportingKeys.party(id), queryFn: () => source.partyName(id), retry: false, staleTime: 300_000 })),
  });
  const names = new Map<string, string>();
  unique.forEach((id, index) => {
    const name = results[index]?.data;
    if (typeof name === 'string') names.set(id, name);
  });
  return (id, known) => known ?? names.get(id) ?? 'Mandant';
}

function useReportingMutation<I, O>(run: (input: I) => Promise<O>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSettled: () => client.invalidateQueries({ queryKey: REPORTING_ROOT }),
  });
}

export function useCreateReports() {
  const source = useReportingSource();
  return useReportingMutation(({ input, key }: { input: CreateReportsInput; key: string }) => source.createReports(input, key));
}

export function useUpdateReport() {
  const source = useReportingSource();
  return useReportingMutation(({ id, lockVersion, changes }: { id: string; lockVersion: number; changes: ReportChanges }) => source.updateReport(id, lockVersion, changes));
}

export function useGenerateReport() {
  const source = useReportingSource();
  return useReportingMutation((id: string) => source.generateReport(id));
}

export function useDiscardReport() {
  const source = useReportingSource();
  return useReportingMutation((id: string) => source.discardReport(id));
}

export function usePublishReport() {
  const source = useReportingSource();
  return useReportingMutation((id: string) => source.publishReport(id));
}

export function useScheduleReport() {
  const source = useReportingSource();
  return useReportingMutation(({ id, at }: { id: string; at: string }) => source.scheduleReport(id, at));
}

export function useUnscheduleReport() {
  const source = useReportingSource();
  return useReportingMutation((id: string) => source.unscheduleReport(id));
}

export function useRectifyReport() {
  const source = useReportingSource();
  return useReportingMutation(({ id, reason }: { id: string; reason: string }) => source.rectifyReport(id, reason));
}

export function useReportPdf() {
  const source = useReportingSource();
  return useMutation({ mutationFn: (id: string) => source.pdf(id) });
}

export function useLinesCsv() {
  const source = useReportingSource();
  return useMutation({ mutationFn: (id: string) => source.linesCsv(id) });
}

export function useStatementCsv() {
  const source = useReportingSource();
  return useMutation({ mutationFn: ({ mandantId, from, to }: { mandantId: string; from: string; to: string }) => source.statementCsv(mandantId, from, to) });
}

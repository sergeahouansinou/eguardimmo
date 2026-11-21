'use client';

import { Button } from '@eguardimmo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Component, useEffect } from 'react';
import type { ReactNode } from 'react';
import { CONFORMITE_ROOT, useCertificates } from '../../conformite/hooks';
import type { Certificate } from '../../conformite/model';
import { MAINTENANCE_ROOT, useInterventions } from '../../maintenance/hooks';
import type { Intervention } from '../../maintenance/model';
import type { DateRange } from './calendar';
import { certificateItem, interventionItems } from './items';
import type { AgendaItem } from './items';
import type { AgendaSource } from './labels';

export type FlowStatus = 'loading' | 'ready' | 'forbidden' | 'error';

export interface FlowReport {
  items: AgendaItem[];
  status: FlowStatus;
  truncated: boolean;
}

export type ReportFlow = (source: AgendaSource, report: FlowReport) => void;

const PAGE_SIZE = 100;

const isForbidden = (error: unknown): boolean => typeof error === 'object' && error !== null && 'kind' in error && error.kind === 'forbidden';

interface FlowQuery<T> {
  data: T | undefined;
  isError: boolean;
  isPending: boolean;
  error: Error | null;
}

function useFlowReport<T>(source: AgendaSource, query: FlowQuery<T>, toReport: (data: T) => { items: AgendaItem[]; truncated: boolean }, report: ReportFlow): FlowStatus {
  const { data, error, isError, isPending } = query;
  const status: FlowStatus = isError ? (isForbidden(error) ? 'forbidden' : 'error') : isPending || data === undefined ? 'loading' : 'ready';
  useEffect(() => {
    const mapped = data === undefined ? { items: [], truncated: false } : toReport(data);
    report(source, { ...mapped, status });
  }, [data, status, source, report, toReport]);
  return status;
}

function FlowNote({ status, label, truncated, onRetry }: { status: FlowStatus; label: string; truncated: boolean; onRetry: () => void }) {
  if (status === 'error') {
    return (
      <p role="alert" className="flex flex-wrap items-center gap-2 text-caption text-danger-fg">
        {label} : chargement impossible.
        <Button variant="secondary" size="sm" onClick={onRetry}>Réessayer</Button>
      </p>
    );
  }
  if (status === 'forbidden') return <p className="text-caption text-fg-subtle">{label} : masquées, votre rôle n’y donne pas accès.</p>;
  if (truncated) return <p className="text-caption text-fg-subtle">{label} : seules les {PAGE_SIZE} premières de la période sont affichées. Réduisez la période pour les voir toutes.</p>;
  return null;
}

const interventionReport = (page: { items: Intervention[]; nextCursor: string | null }) => ({
  items: page.items.flatMap(interventionItems),
  truncated: page.nextCursor !== null,
});

const certificateReport = (page: { items: Certificate[]; nextCursor: string | null }) => ({
  items: page.items.flatMap((certificate) => certificateItem(certificate) ?? []),
  truncated: page.nextCursor !== null,
});

function InterventionsFlow({ range, report }: { range: DateRange; report: ReportFlow }) {
  const client = useQueryClient();
  const query = useInterventions({ dueFrom: range.from, dueTo: range.to, perPage: PAGE_SIZE });
  const status = useFlowReport('intervention', query, interventionReport, report);
  const truncated = query.data?.nextCursor != null;
  return <FlowNote status={status} label="Interventions" truncated={truncated} onRetry={() => { void client.invalidateQueries({ queryKey: MAINTENANCE_ROOT }); }} />;
}

function CertificatesFlow({ range, report }: { range: DateRange; report: ReportFlow }) {
  const client = useQueryClient();
  const query = useCertificates({ expiresFrom: range.from, expiresTo: range.to, perPage: PAGE_SIZE });
  const status = useFlowReport('certificate', query, certificateReport, report);
  const truncated = query.data?.nextCursor != null;
  return <FlowNote status={status} label="Échéances de conformité" truncated={truncated} onRetry={() => { void client.invalidateQueries({ queryKey: CONFORMITE_ROOT }); }} />;
}

interface BoundaryProps {
  source: AgendaSource;
  label: string;
  report: ReportFlow;
  children: ReactNode;
}

class FlowBoundary extends Component<BoundaryProps, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(): void {
    this.props.report(this.props.source, { items: [], status: 'error', truncated: false });
  }

  override render(): ReactNode {
    if (this.state.failed) return <p className="text-caption text-fg-subtle">{this.props.label} : non disponibles dans cet espace.</p>;
    return this.props.children;
  }
}

export function AgendaFlows({ range, enabled, report }: { range: DateRange; enabled: ReadonlySet<AgendaSource>; report: ReportFlow }) {
  return (
    <div className="flex flex-col gap-1" aria-live="polite">
      {enabled.has('intervention') ? (
        <FlowBoundary source="intervention" label="Interventions" report={report}>
          <InterventionsFlow range={range} report={report} />
        </FlowBoundary>
      ) : null}
      {enabled.has('certificate') ? (
        <FlowBoundary source="certificate" label="Échéances de conformité" report={report}>
          <CertificatesFlow range={range} report={report} />
        </FlowBoundary>
      ) : null}
    </div>
  );
}

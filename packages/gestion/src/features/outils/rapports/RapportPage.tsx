'use client';

import { useMemo, useState } from 'react';
import { CalendarClock, Download, Eye } from 'lucide-react';
import { Button, Icon } from '@eguardimmo/ui';
import { EmptyBlock, ErrorBlock, PageHeader, QueryState } from '../kit';
import type { ScreenProps } from '../kit';
import { KpiCard } from '../analytique/components/KpiCard';
import { downloadCsv } from '../analytique/csv';
import { formatDateFr, plural } from '../analytique/format';
import { findReport, reportHref } from './catalog';
import { findDefinition } from './definitions';
import { buildReport, decodeReportFilters, defaultFilters, encodeReportFilters, reportDataset } from './engine/engine';
import type { ReportFilters } from './engine/types';
import { ReportFiltersBar } from './ReportFilters';
import { ReportTable } from './ReportTable';
import { ScheduleDialog } from './SendDialogs';
import { useReportsData } from './source';

export interface RapportPageProps extends ScreenProps {
  slug: string;
  search?: string;
}

export function RapportPage({ Link, navigate, slug, search = '' }: RapportPageProps) {
  const definition = findDefinition(slug);
  const report = findReport(slug);
  if (!definition || !report) {
    return (
      <>
        <PageHeader Link={Link} crumbs={[{ label: 'Outils' }, { label: 'Rapports', href: '/rapports' }, { label: 'Rapport introuvable' }]} title="Rapport introuvable" />
        <ErrorBlock title="Ce rapport n’existe pas ou n’est plus disponible." />
      </>
    );
  }
  return <RapportContent Link={Link} navigate={navigate} slug={slug} search={search} />;
}

function RapportContent({ Link, navigate, slug, search }: RapportPageProps & { search: string }) {
  const definition = findDefinition(slug);
  const report = findReport(slug);
  const query = useReportsData();
  const [filters, setFilters] = useState<ReportFilters>(() => (definition ? decodeReportFilters(definition, new URLSearchParams(search)) : { period: '', lotId: 'all', tenantId: 'all', group: 'none' }));
  const [scheduling, setScheduling] = useState(false);
  const view = useMemo(() => (definition && query.data ? buildReport(definition, query.data, filters) : null), [definition, query.data, filters]);
  if (!definition || !report) return null;
  const reset = () => { setFilters(defaultFilters(definition)); };

  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Outils' }, { label: 'Rapports', href: '/rapports' }, { label: report.label }]}
        title={report.label}
        description={definition.description}
        actions={
          <>
            <Button variant="ghost" onClick={() => { setScheduling(true); }}>
              <Icon icon={CalendarClock} />
              Programmer l’envoi
            </Button>
            <Button variant="secondary" disabled={!view?.hasData} onClick={() => { if (view) downloadCsv(slug, reportDataset(view)); }}>
              <Icon icon={Download} />
              Exporter en Excel
            </Button>
            <Button onClick={() => { navigate(`${reportHref(slug)}/apercu?${encodeReportFilters(filters)}`); }}>
              <Icon icon={Eye} />
              Aperçu PDF
            </Button>
          </>
        }
      />
      <QueryState query={query} errorTitle="Le rapport n’a pas pu être chargé" loadingLabel="Chargement du rapport">
        {(data) => (
          <>
            <ReportFiltersBar definition={definition} data={data} filters={filters} onChange={(next) => { setFilters((current) => ({ ...current, ...next })); }} onReset={reset} />
            {view?.hasData ? (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {view.kpis.map((kpi) => (
                    <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} tone={kpi.tone ?? 'default'} caption={kpi.caption} />
                  ))}
                </div>
                <ReportTable view={view} />
                <div className="flex flex-wrap justify-between gap-2 text-caption text-fg-subtle">
                  <span>{definition.note ?? ''}</span>
                  <span>{`${plural(view.rows.length, 'ligne', 'lignes')}, données arrêtées au ${formatDateFr(data.today)}`}</span>
                </div>
              </>
            ) : (
              <EmptyBlock
                title="Aucune donnée sur cette période"
                action={
                  <Button variant="secondary" size="sm" onClick={reset}>
                    Réinitialiser les filtres
                  </Button>
                }
              >
                {definition.emptyHint}
              </EmptyBlock>
            )}
            <ScheduleDialog open={scheduling} onOpenChange={setScheduling} report={{ slug, label: report.label }} />
          </>
        )}
      </QueryState>
    </>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { Badge, Button, cx } from '@eguardimmo/ui';
import type { BadgeTone } from '@eguardimmo/ui';
import { EmptyBlock, PageHeader, QueryState, Switch } from '../kit';
import type { ScreenProps } from '../kit';
import { ChartCard, ChartLegend, LineAreaChart } from './charts';
import { DEFAULT_FILTERS } from './compute/aggregate';
import { buildOccupation } from './compute/occ';
import type { OccFilters, OccView } from './compute/occ';
import type { LeaseEndRow } from './compute/occupation';
import { BuildingSelect, FilterBar, FilterSeparator, PeriodFilter, TypeSelect } from './components/FilterBar';
import { KpiCard } from './components/KpiCard';
import { ScreenActions } from './components/ScreenActions';
import { OCCUPANCY_LABELS } from './constants';
import { downloadCsv } from './csv';
import { formatDateFr, formatPercentValue, formatRoundedEuros, periodPhrase } from './format';
import { monthAxisLabel, monthLongLabel } from './months';
import { PlanningGrid, STATUS_ORDER, statusSwatchClass } from './PlanningGrid';
import { useAnalytiqueData } from './source';

const DEFAULTS: OccFilters = { ...DEFAULT_FILTERS, works: true };

const LEASE_LABELS: Record<LeaseEndRow['kind'], { label: string; tone: BadgeTone }> = {
  preavis: { label: 'Préavis reçu', tone: 'warning' },
  reconduction: { label: 'Reconduction', tone: 'neutral' },
  etudiant: { label: 'Bail étudiant', tone: 'info' },
};

const shortDate = (iso: string): string => `${formatDateFr(iso).slice(0, 6)}${iso.slice(2, 4)}`;

export function AnalytiqueOccPage({ Link }: ScreenProps) {
  const query = useAnalytiqueData();
  const [filters, setFilters] = useState<OccFilters>(DEFAULTS);
  const view = useMemo(() => (query.data ? buildOccupation(query.data, filters) : null), [query.data, filters]);
  const patch = (next: Partial<OccFilters>) => { setFilters((current) => ({ ...current, ...next })); };
  const reset = () => { setFilters(DEFAULTS); };

  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Analytique', href: '/analytique' }, { label: 'Occupation' }]}
        title="Occupation"
        description={`Lots loués, vacance et fins de bail ${periodPhrase(filters.period, filters.from, filters.to)}.`}
        actions={
          <ScreenActions
            stamp={query.data?.generatedAt}
            onRefresh={query.refetch}
            onExport={view ? () => { downloadCsv('analytique-occupation', view.exportDataset); } : undefined}
          />
        }
      />
      <QueryState query={query} errorTitle="L’analytique n’a pas pu être chargée">
        {(data) => (
          <>
            <FilterBar onReset={reset}>
              <PeriodFilter filters={filters} onChange={patch} />
              <FilterSeparator />
              <BuildingSelect buildings={data.buildings} value={filters.buildingId} onValueChange={(buildingId) => { patch({ buildingId }); }} />
              <TypeSelect value={filters.type} onValueChange={(type) => { patch({ type }); }} />
              <FilterSeparator />
              <Switch label="Travaux en vacance" checked={filters.works} onCheckedChange={(works) => { patch({ works }); }} />
            </FilterBar>
            {view?.hasData ? (
              <OccBody view={view} />
            ) : (
              <EmptyBlock
                title="Aucun lot pour ces filtres"
                action={
                  <Button variant="secondary" size="sm" onClick={reset}>
                    Réinitialiser les filtres
                  </Button>
                }
              >
                Aucun lot ne correspond à la combinaison immeuble et type de bien choisie.
              </EmptyBlock>
            )}
          </>
        )}
      </QueryState>
    </>
  );
}

function OccBody({ view }: { view: OccView }) {
  const tip = (index: number) => ({
    title: monthLongLabel(view.line[index]?.month ?? ''),
    rows: [{ label: "Taux d'occupation", value: formatPercentValue(Math.round(view.line[index]?.value ?? 0), 0), tone: 'revenue' as const }],
  });
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Occupation actuelle"
          value={formatPercentValue(Math.round(view.current.rate), 0)}
          delta={{ direction: 'flat', tone: 'neutral', text: `${String(view.current.rented)} lots sur ${String(view.current.total)}` }}
        />
        <KpiCard
          label="Occupation moyenne"
          value={formatPercentValue(Math.round(view.average), 0)}
          spark={view.line.map((entry) => entry.value)}
          delta={view.averageDelta}
          caption="vs N-1"
        />
        <KpiCard
          label="Vacance cumulée"
          value={`${String(view.stats.lotMonths)} mois`}
          delta={{ direction: 'flat', tone: 'neutral', text: `${String(view.stats.days)} jours` }}
          caption="tous lots confondus"
        />
        <KpiCard
          label="Loyers non perçus"
          value={formatRoundedEuros(view.stats.unearned)}
          delta={{ direction: 'down', tone: 'bad', text: formatPercentValue(view.unearnedShare) }}
          caption="des loyers encaissés"
        />
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ChartCard
          id="occ-ligne"
          title="Taux d'occupation par mois"
          dataset={{ columns: ['Mois', "Taux d'occupation (%)"], rows: view.line.map((entry) => [monthLongLabel(entry.month), Math.round(entry.value * 10) / 10]) }}
          csvName="taux-d-occupation-par-mois"
        >
          {() => (
            <LineAreaChart
              label="Taux d'occupation par mois"
              points={view.line.map((entry) => ({ key: entry.month, label: monthAxisLabel(entry.month), value: entry.value }))}
              tip={tip}
              format={(value) => formatPercentValue(Math.round(value), 0)}
              height={200}
            />
          )}
        </ChartCard>
        <ChartCard
          id="occ-fins-bail"
          title="Fins de bail à venir"
          dataset={{
            columns: ['Date', 'Lot', 'Immeuble', 'Statut'],
            rows: view.leaseEnds.map((end) => [formatDateFr(end.date), end.lot.name, end.buildingName, LEASE_LABELS[end.kind].label]),
          }}
          csvName="fins-de-bail-a-venir"
          tableless
        >
          {() =>
            view.leaseEnds.length === 0 ? (
              <EmptyBlock title="Aucune fin de bail à venir">Aucun bail ne se termine pour cette sélection.</EmptyBlock>
            ) : (
              <ul>
                {view.leaseEnds.map((end) => (
                  <li key={`${end.lotId}-${end.date}`} className="flex min-h-11 items-center gap-2.5 border-t border-line first:border-t-0">
                    <span className="w-14 shrink-0 text-caption font-semibold text-fg-muted tabular-nums">{shortDate(end.date)}</span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <b className="truncate text-body-strong text-fg">{end.lot.name}</b>
                      <span className="truncate text-caption text-fg-subtle">{end.buildingName}</span>
                    </span>
                    <Badge tone={LEASE_LABELS[end.kind].tone}>{LEASE_LABELS[end.kind].label}</Badge>
                  </li>
                ))}
              </ul>
            )
          }
        </ChartCard>
      </div>
      <ChartCard
        id="occ-planning"
        title="Planning d'occupation par lot"
        dataset={view.exportDataset}
        csvName="planning-d-occupation"
        tableless
        legend={
          <ChartLegend>
            {STATUS_ORDER.map((status) => (
              <span key={status} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <i aria-hidden="true" className={cx('size-2.5 rounded-[2px]', statusSwatchClass(status))} />
                {OCCUPANCY_LABELS[status]}
              </span>
            ))}
          </ChartLegend>
        }
      >
        {() => <PlanningGrid rows={view.rows} months={view.months} />}
      </ChartCard>
    </>
  );
}

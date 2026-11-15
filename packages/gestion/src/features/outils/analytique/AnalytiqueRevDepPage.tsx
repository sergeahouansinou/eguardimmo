'use client';

import { useMemo, useState } from 'react';
import { Alert, Button, cx } from '@eguardimmo/ui';
import { DataTable, EmptyBlock, PageHeader, QueryState, Switch, Td, Th } from '../kit';
import type { ScreenProps } from '../kit';
import { ChartCard, ChartLegend, GroupedBarChart, HorizontalBars, LegendItem } from './charts';
import type { BarSeries } from './charts';
import { DEFAULT_FILTERS } from './compute/aggregate';
import type { Filters } from './compute/aggregate';
import { buildRevDep, heatBucket, heatHeaders, provisionsMessage } from './compute/revdep';
import type { RevDepView } from './compute/revdep';
import { BuildingSelect, FilterBar, FilterSeparator, PeriodFilter, TypeSelect } from './components/FilterBar';
import { KpiCard } from './components/KpiCard';
import { ScreenActions } from './components/ScreenActions';
import { downloadCsv } from './csv';
import { changePercent, formatEuros, formatPercentValue, formatRoundedEuros, formatWholeEuros } from './format';
import { monthAxisLabel, monthLongLabel, addMonths } from './months';
import { useAnalytiqueData } from './source';

const DEFAULTS: Filters = { ...DEFAULT_FILTERS, compare: true };

const HEAT_CLASSES = ['', 'bg-warning-line/10', 'bg-warning-line/15', 'bg-warning-line/20', 'bg-warning-line/30', 'bg-warning-line/45'] as const;

export function AnalytiqueRevDepPage({ Link }: ScreenProps) {
  const query = useAnalytiqueData();
  const [filters, setFilters] = useState<Filters>(DEFAULTS);
  const view = useMemo(() => (query.data ? buildRevDep(query.data, filters) : null), [query.data, filters]);
  const patch = (next: Partial<Filters>) => { setFilters((current) => ({ ...current, ...next })); };
  const reset = () => { setFilters(DEFAULTS); };

  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Analytique', href: '/analytique' }, { label: 'Revenus et dépenses' }]}
        title="Revenus et dépenses"
        description="Ce que rapportent et coûtent vos biens, mois par mois, comparé à l'année précédente."
        actions={
          <ScreenActions
            stamp={query.data?.generatedAt}
            onRefresh={query.refetch}
            onExport={view ? () => { downloadCsv('analytique-revenus-depenses', view.exportDataset); } : undefined}
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
              <Switch label="Comparer à N-1" checked={filters.compare} onCheckedChange={(compare) => { patch({ compare }); }} />
            </FilterBar>
            {view?.hasData ? (
              <RevDepBody view={view} filters={filters} />
            ) : (
              <EmptyBlock
                title="Aucune donnée pour ces filtres"
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

function RevDepBody({ view, filters }: { view: RevDepView; filters: Filters }) {
  const categories = view.months.map((month) => ({ key: month, label: monthAxisLabel(month) }));
  const series: BarSeries[] = [];
  if (filters.compare) series.push({ key: 'n1', tone: 'muted', values: view.previous.map((point) => point.revenus) });
  series.push({ key: 'courant', tone: 'revenue', values: view.points.map((point) => point.revenus) });

  const tip = (index: number) => {
    const point = view.points[index];
    const before = view.previous[index];
    const gap = point && before ? changePercent(point.revenus, before.revenus) : null;
    return {
      title: monthLongLabel(point?.month ?? view.months[0] ?? ''),
      rows: [
        { label: 'Ce mois', value: formatEuros(point?.revenus ?? 0), tone: 'revenue' as const },
        ...(filters.compare
          ? [
              { label: monthLongLabel(addMonths(point?.month ?? view.months[0] ?? '', -12)), value: formatEuros(before?.revenus ?? 0), tone: 'muted' as const },
              ...(gap === null ? [] : [{ label: 'Écart', value: `${gap > 0 ? '+' : gap < 0 ? '−' : ''}${formatPercentValue(Math.abs(gap))}` }]),
            ]
          : []),
      ],
    };
  };

  const chartDataset = {
    columns: filters.compare ? ['Mois', 'Mois courant', 'Même mois N-1'] : ['Mois', 'Revenus'],
    rows: view.points.map((point, index) => {
      const row: (string | { minor: number })[] = [monthLongLabel(point.month), { minor: point.revenus }];
      if (filters.compare) row.push({ minor: view.previous[index]?.revenus ?? 0 });
      return row;
    }),
  };

  const originDataset = {
    columns: ['Poste', 'Montant'],
    rows: [...view.sources, ...view.recoverable].map((entry) => [entry.label, { minor: entry.amount }]),
  };

  const matrixDataset = {
    columns: ['Catégorie', ...view.months.map((month) => monthLongLabel(month)), 'Total'],
    rows: [
      ...view.heatRows.map((row) => [row.label, ...row.cells.map((cell) => ({ minor: cell })), { minor: row.total }]),
      ['Total', ...view.heatTotals.map((cell) => ({ minor: cell })), { minor: view.heatTotals.reduce((acc, cell) => acc + cell, 0) }],
    ],
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {view.kpis.map((kpi) => (
          <KpiCard
            key={kpi.id}
            label={kpi.label}
            value={kpi.value}
            spark={kpi.spark}
            sparkTone={kpi.tone}
            delta={kpi.delta}
            caption={kpi.id === 'charges' ? 'Dépenses sur revenus' : (kpi.previousText ?? 'vs N-1')}
          />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ChartCard
          id="revdep-revenus"
          title={filters.compare ? 'Revenus par mois, 2026 et N-1' : 'Revenus par mois'}
          dataset={chartDataset}
          csvName="revenus-par-mois"
          legend={
            <ChartLegend>
              {filters.compare ? <LegendItem tone="muted">N-1</LegendItem> : null}
              <LegendItem tone="revenue">12 derniers mois</LegendItem>
            </ChartLegend>
          }
        >
          {() => <GroupedBarChart label="Revenus par mois" categories={categories} series={series} tip={tip} height={232} />}
        </ChartCard>
        <ChartCard id="revdep-origine" title="D'où viennent les revenus" dataset={originDataset} csvName="origine-des-revenus">
          {() => (
            <>
              <HorizontalBars
                label="Origine des revenus"
                tone="revenue"
                rows={view.sources.map((source) => ({ key: source.key, label: source.label, value: source.amount, text: formatRoundedEuros(source.amount) }))}
              />
              <h3 className="mt-1 text-body-strong text-fg">Dépenses récupérables</h3>
              <HorizontalBars
                label="Dépenses récupérables"
                tone="expense"
                rows={view.recoverable.map((entry) => ({ key: entry.key, label: entry.label, value: entry.amount, text: formatRoundedEuros(entry.amount) }))}
              />
              <Alert tone="info">{provisionsMessage(view.provisions)}</Alert>
            </>
          )}
        </ChartCard>
      </div>
      <ChartCard
        id="revdep-matrice"
        title="Dépenses par catégorie et par mois"
        dataset={matrixDataset}
        csvName="depenses-par-categorie-et-par-mois"
        note="Plus la case est foncée, plus la dépense est forte"
        tableless
      >
        {() => <HeatTable view={view} />}
      </ChartCard>
    </>
  );
}

function HeatTable({ view }: { view: RevDepView }) {
  const grandTotal = view.heatTotals.reduce((acc, cell) => acc + cell, 0);
  return (
    <DataTable caption="Dépenses par catégorie et par mois, en euros" className="text-fg">
      <thead>
        <tr>
          <Th>Catégorie</Th>
          {heatHeaders(view.months).map((header) => (
            <Th key={header} numeric>
              {header}
            </Th>
          ))}
          <Th numeric>Total</Th>
        </tr>
      </thead>
      <tbody>
        {view.heatRows.map((row) => (
          <tr key={row.id}>
            <th scope="row" className="h-8 border-b border-line px-2 text-left font-normal whitespace-nowrap">
              {row.label}
            </th>
            {row.cells.map((cell, index) => (
              <Td
                key={view.months[index]}
                numeric
                className={cx('h-8', HEAT_CLASSES[heatBucket(cell, view.heatMax)], cell === 0 && 'text-fg-subtle')}
              >
                {formatWholeEuros(cell)}
              </Td>
            ))}
            <Td numeric strong className="h-8">
              {formatWholeEuros(row.total)}
            </Td>
          </tr>
        ))}
        <tr className="bg-muted">
          <th scope="row" className="h-8 px-2 text-left font-semibold whitespace-nowrap">
            Total
          </th>
          {view.heatTotals.map((cell, index) => (
            <Td key={view.months[index]} numeric strong className="h-8 border-b-0">
              {formatWholeEuros(cell)}
            </Td>
          ))}
          <Td numeric strong className="h-8 border-b-0">
            {formatWholeEuros(grandTotal)}
          </Td>
        </tr>
      </tbody>
    </DataTable>
  );
}

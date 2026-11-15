'use client';

import { useMemo, useState } from 'react';
import { Button } from '@eguardimmo/ui';
import { EmptyBlock, PageHeader, QueryState, Switch } from '../kit';
import type { ScreenProps } from '../kit';
import { ChartCard, ChartLegend, GroupedBarChart, HorizontalBars, LegendItem, LineAreaChart } from './charts';
import type { BarSeries } from './charts';
import { DEFAULT_FILTERS } from './compute/aggregate';
import type { Filters } from './compute/aggregate';
import { buildVue, expenseHighlight } from './compute/vue';
import type { VueView } from './compute/vue';
import { BuildingSelect, FilterBar, FilterSeparator, PeriodFilter, TypeSelect } from './components/FilterBar';
import { KpiCard } from './components/KpiCard';
import { ScreenActions } from './components/ScreenActions';
import { downloadCsv } from './csv';
import { formatEuros, formatPercentValue, formatRoundedEuros, periodPhrase, plural } from './format';
import { monthAxisLabel, monthLongLabel } from './months';
import { useAnalytiqueData } from './source';

const footerClass = 'text-caption text-fg-subtle';

export function AnalytiqueVuePage({ Link }: ScreenProps) {
  const query = useAnalytiqueData();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const view = useMemo(() => (query.data ? buildVue(query.data, filters) : null), [query.data, filters]);
  const patch = (next: Partial<Filters>) => { setFilters((current) => ({ ...current, ...next })); };
  const reset = () => { setFilters(DEFAULT_FILTERS); };

  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Analytique', href: '/analytique' }, { label: "Vue d'ensemble" }]}
        title="Vue d'ensemble"
        description={
          query.data
            ? `Revenus, dépenses et occupation de vos ${String(query.data.lots.length)} lots, ${periodPhrase(filters.period, filters.from, filters.to)}.`
            : undefined
        }
        actions={
          <ScreenActions
            stamp={query.data?.generatedAt}
            onRefresh={query.refetch}
            onExport={view ? () => { downloadCsv('analytique-vue-ensemble', view.exportDataset); } : undefined}
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
              <VueBody view={view} filters={filters} onBuilding={(buildingId) => { patch({ buildingId }); }} />
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

interface VueBodyProps {
  view: VueView;
  filters: Filters;
  onBuilding: (buildingId: string) => void;
}

function VueBody({ view, filters, onBuilding }: VueBodyProps) {
  const categories = view.months.map((month) => ({ key: month, label: monthAxisLabel(month) }));
  const series: BarSeries[] = [
    { key: 'revenus', tone: 'revenue', values: view.points.map((point) => point.revenus) },
    { key: 'depenses', tone: 'expense', values: view.points.map((point) => point.depenses) },
  ];
  if (filters.compare) series.push({ key: 'revenus-n1', tone: 'muted', values: view.previous.map((point) => point.revenus) });

  const monthlyDataset = {
    columns: filters.compare ? ['Mois', 'Revenus', 'Dépenses', 'Revenus N-1'] : ['Mois', 'Revenus', 'Dépenses'],
    rows: view.points.map((point, index) => {
      const row: (string | { minor: number })[] = [monthLongLabel(point.month), { minor: point.revenus }, { minor: point.depenses }];
      if (filters.compare) row.push({ minor: view.previous[index]?.revenus ?? 0 });
      return row;
    }),
  };

  const tip = (index: number) => {
    const point = view.points[index];
    const highlight = point ? expenseHighlight(point) : null;
    return {
      title: monthLongLabel(point?.month ?? view.months[0] ?? ''),
      rows: [
        { label: 'Revenus', value: formatEuros(point?.revenus ?? 0), tone: 'revenue' as const },
        { label: 'Dépenses', value: formatEuros(point?.depenses ?? 0), tone: 'expense' as const },
        ...(filters.compare ? [{ label: 'Revenus N-1', value: formatEuros(view.previous[index]?.revenus ?? 0), tone: 'muted' as const }] : []),
        ...(highlight ? [{ label: highlight.label, value: formatEuros(highlight.amount) }] : []),
      ],
    };
  };

  const occupancyTip = (index: number) => ({
    title: monthLongLabel(view.occupancy[index]?.month ?? ''),
    rows: [{ label: "Taux d'occupation", value: formatPercentValue(Math.round(view.occupancy[index]?.value ?? 0), 0), tone: 'revenue' as const }],
  });

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {view.kpis.map((kpi) => (
          <KpiCard
            key={kpi.id}
            label={kpi.label}
            value={kpi.value}
            spark={kpi.spark}
            sparkTone={kpi.tone}
            delta={kpi.delta}
            caption={kpi.previousText ?? 'vs N-1'}
          />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ChartCard
          id="analytique-revenus-depenses"
          title="Revenus et dépenses par mois"
          dataset={monthlyDataset}
          csvName="revenus-et-depenses-par-mois"
          legend={
            <ChartLegend>
              <LegendItem tone="revenue">Revenus</LegendItem>
              <LegendItem tone="expense">Dépenses</LegendItem>
              {filters.compare ? <LegendItem tone="muted">Revenus N-1</LegendItem> : null}
            </ChartLegend>
          }
        >
          {() => (
            <GroupedBarChart
              label="Revenus et dépenses par mois"
              categories={categories}
              series={series}
              tip={tip}
              initialActive={view.topExpenseIndex}
              height={254}
            />
          )}
        </ChartCard>
        <ChartCard
          id="analytique-categories"
          title="Dépenses par catégorie"
          dataset={{ columns: ['Catégorie', 'Montant'], rows: view.categories.map((category) => [category.label, { minor: category.amount }]) }}
          csvName="depenses-par-categorie"
          footer={<span className={footerClass}>{`Total ${formatRoundedEuros(view.expensesTotal)} ${periodPhrase(filters.period, filters.from, filters.to)}`}</span>}
        >
          {() => (
            <HorizontalBars
              label="Dépenses par catégorie"
              tone="expense"
              rows={view.categories.map((category) => ({ key: category.id, label: category.label, value: category.amount, text: formatRoundedEuros(category.amount) }))}
            />
          )}
        </ChartCard>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <ChartCard
          id="analytique-occupation"
          title="Taux d'occupation"
          dataset={{ columns: ['Mois', "Taux d'occupation (%)"], rows: view.occupancy.map((entry) => [monthLongLabel(entry.month), Math.round(entry.value * 10) / 10]) }}
          csvName="taux-d-occupation"
        >
          {() => (
            <LineAreaChart
              label="Taux d'occupation par mois"
              points={view.occupancy.map((entry) => ({ key: entry.month, label: monthAxisLabel(entry.month), value: entry.value }))}
              tip={occupancyTip}
              format={(value) => formatPercentValue(Math.round(value), 0)}
            />
          )}
        </ChartCard>
        <ChartCard
          id="analytique-impayes"
          title="Impayés par ancienneté"
          dataset={{ columns: ['Ancienneté', 'Montant'], rows: view.arrears.map((bucket) => [bucket.label, { minor: bucket.amount }]) }}
          csvName="impayes-par-anciennete"
          footer={<span className={footerClass}>{`Total ${formatRoundedEuros(view.arrearsTotal)} · ${plural(view.arrearsTenants, 'locataire', 'locataires')}`}</span>}
        >
          {() => (
            <HorizontalBars
              label="Impayés par ancienneté"
              tone="revenue"
              rows={view.arrears.map((bucket) => ({ key: bucket.id, label: bucket.label, value: bucket.amount, text: formatRoundedEuros(bucket.amount) }))}
            />
          )}
        </ChartCard>
        <ChartCard
          id="analytique-immeubles"
          title="Revenus par immeuble"
          dataset={{ columns: ['Immeuble', 'Revenus'], rows: view.buildings.map((building) => [building.name, { minor: building.amount }]) }}
          csvName="revenus-par-immeuble"
          footer={<span className={footerClass}>Cliquez sur un immeuble pour filtrer la page</span>}
        >
          {() => (
            <HorizontalBars
              label="Revenus par immeuble"
              tone="revenue"
              selectedKey={filters.buildingId}
              onSelect={(key) => { onBuilding(filters.buildingId === key ? 'all' : key); }}
              rows={view.buildings.map((building) => ({ key: building.id, label: building.name, value: building.amount, text: formatRoundedEuros(building.amount) }))}
            />
          )}
        </ChartCard>
      </div>
    </>
  );
}

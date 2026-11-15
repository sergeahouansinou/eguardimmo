'use client';

import { useMemo, useState } from 'react';
import { Badge, Button } from '@eguardimmo/ui';
import { DataTable, EmptyBlock, PageHeader, QueryState, Segmented, SortTh, Switch, Td } from '../kit';
import type { ScreenProps, SortDirection } from '../kit';
import { ChartCard, HorizontalBars } from './charts';
import type { RentaPeriod } from './compute/renta';
import { RENTA_DEFAULTS, buildRentaView, rentaDataset, sortRows } from './compute/rentaView';
import type { RentaFilters, RentaSortKey, RentaViewModel } from './compute/rentaView';
import { BuildingSelect, FilterBar, FilterLabel, FilterSeparator, TypeSelect } from './components/FilterBar';
import { KpiCard } from './components/KpiCard';
import { ScreenActions } from './components/ScreenActions';
import { downloadCsv } from './csv';
import { formatPercentValue, formatWholeEuros } from './format';
import { useAnalytiqueData } from './source';

const PERIOD_OPTIONS: { value: RentaPeriod; label: string }[] = [
  { value: '12m', label: '12 mois' },
  { value: 'y2026', label: 'Année 2026' },
  { value: 'y2025', label: 'Année 2025' },
];

const PERIOD_PHRASES: Record<RentaPeriod, string> = {
  '12m': 'sur 12 mois glissants',
  y2026: "sur l'année 2026",
  y2025: "sur l'année 2025",
};

const SORT_LABELS: Record<RentaSortKey, string> = {
  lot: 'lot',
  building: 'immeuble',
  cost: 'prix de revient',
  rents: 'loyers',
  charges: 'charges',
  result: 'résultat',
  gross: 'rendement brut',
  net: 'rendement net',
  months: 'mois loués',
};

export function AnalytiqueRentaPage({ Link }: ScreenProps) {
  const query = useAnalytiqueData();
  const [filters, setFilters] = useState<RentaFilters>(RENTA_DEFAULTS);
  const view = useMemo(() => (query.data ? buildRentaView(query.data, filters) : null), [query.data, filters]);
  const patch = (next: Partial<RentaFilters>) => { setFilters((current) => ({ ...current, ...next })); };
  const reset = () => { setFilters(RENTA_DEFAULTS); };

  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Analytique', href: '/analytique' }, { label: 'Rentabilité par bien' }]}
        title="Rentabilité par bien"
        description={`Rendement et résultat de chaque lot ${PERIOD_PHRASES[filters.period]}, avant impôt.`}
        actions={
          <ScreenActions
            stamp={query.data?.generatedAt}
            onRefresh={query.refetch}
            onExport={view ? () => { downloadCsv('analytique-rentabilite', rentaDataset(view.rows, view.totals)); } : undefined}
          />
        }
      />
      <QueryState query={query} errorTitle="L’analytique n’a pas pu être chargée">
        {(data) => (
          <>
            <FilterBar onReset={reset}>
              <FilterLabel>Période</FilterLabel>
              <Segmented label="Période" options={PERIOD_OPTIONS} value={filters.period} onValueChange={(period) => { patch({ period }); }} />
              <FilterSeparator />
              <BuildingSelect buildings={data.buildings} value={filters.buildingId} onValueChange={(buildingId) => { patch({ buildingId }); }} />
              <TypeSelect value={filters.type} onValueChange={(type) => { patch({ type }); }} />
              <FilterSeparator />
              <Switch label="Inclure les emprunts" checked={filters.loans} onCheckedChange={(loans) => { patch({ loans }); }} />
            </FilterBar>
            {view?.hasData ? (
              <RentaBody view={view} />
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

function RentaBody({ view }: { view: RentaViewModel }) {
  const [sort, setSort] = useState<{ key: RentaSortKey; direction: SortDirection }>({ key: 'net', direction: 'desc' });
  const sorted = useMemo(() => sortRows(view.rows, sort.key, sort.direction), [view.rows, sort]);
  const peak = Math.max(0, ...view.rows.map((row) => row.net));
  const toggle = (key: RentaSortKey) => {
    setSort((current) => ({ key, direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc' }));
  };
  const head = (key: RentaSortKey, label: string, numeric = true) => (
    <SortTh label={label} active={sort.key === key} direction={sort.direction} numeric={numeric} onSort={() => { toggle(key); }} />
  );
  const dataset = rentaDataset(sorted, view.totals);
  const monthsRate = view.totals.months === 0 ? 0 : Math.round((view.totals.rentedMonths / view.totals.months) * 100);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Rendement brut" value={view.kpis.gross.value} delta={view.kpis.gross.delta} caption="vs N-1" />
        <KpiCard label="Rendement net" value={view.kpis.net.value} delta={view.kpis.net.delta} caption="vs N-1" />
        <KpiCard label="Résultat net" value={view.kpis.result.value} delta={view.kpis.result.delta} caption="vs N-1" />
        <KpiCard
          label="Lot le moins rentable"
          value={view.kpis.weakest?.value ?? '—'}
          delta={view.kpis.weakest ? { direction: 'flat', tone: 'bad', text: view.kpis.weakest.detail } : null}
        />
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)]">
        <ChartCard
          id="renta-barres"
          title="Rendement net par lot"
          dataset={{ columns: ['Lot', 'Rendement net (%)'], rows: view.rows.map((row) => [row.lot.name, Math.round(row.net * 10) / 10]) }}
          csvName="rendement-net-par-lot"
          footer={<span className="text-caption text-fg-subtle">Résultat net rapporté au prix de revient</span>}
        >
          {() => (
            <HorizontalBars
              label="Rendement net par lot"
              tone="revenue"
              rows={view.rows.map((row) => ({ key: row.lot.id, label: row.lot.name, value: row.net, text: formatPercentValue(row.net) }))}
            />
          )}
        </ChartCard>
        <ChartCard
          id="renta-detail"
          title="Détail par lot"
          dataset={dataset}
          csvName="detail-par-lot"
          note={`Trié par ${SORT_LABELS[sort.key]}`}
          tableless
        >
          {() => (
            <DataTable caption="Détail de la rentabilité par lot, en euros" className="text-fg">
              <thead>
                <tr>
                  {head('lot', 'Lot', false)}
                  {head('building', 'Immeuble', false)}
                  {head('cost', 'Prix de revient')}
                  {head('rents', 'Loyers HC')}
                  {head('charges', 'Charges')}
                  {head('result', 'Résultat')}
                  {head('gross', 'Brut')}
                  {head('net', 'Net')}
                  {head('months', 'Mois loués')}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr key={row.lot.id}>
                    <th scope="row" className="h-9 border-b border-line px-2 text-left font-medium whitespace-nowrap">
                      {row.lot.name}
                    </th>
                    <Td className="text-caption text-fg-subtle">{row.buildingName}</Td>
                    <Td numeric>{formatWholeEuros(row.costPrice)}</Td>
                    <Td numeric>{formatWholeEuros(row.rents)}</Td>
                    <Td numeric>{formatWholeEuros(-row.charges)}</Td>
                    <Td numeric>{formatWholeEuros(row.result)}</Td>
                    <Td numeric>{formatPercentValue(row.gross)}</Td>
                    <Td numeric>
                      <span className="inline-flex w-full items-center justify-end gap-2">
                        {formatPercentValue(row.net)}
                        <span aria-hidden="true" className="flex h-2.5 w-14 rounded-sm bg-muted">
                          <i
                            style={{ width: `${String(peak === 0 ? 0 : Math.max(0, (row.net / peak) * 100))}%` }}
                            className="block h-full rounded-sm bg-chart-collected"
                          />
                        </span>
                      </span>
                    </Td>
                    <Td numeric>
                      {row.rentedMonths < row.months ? (
                        <Badge tone="warning">{`${String(row.rentedMonths)} / ${String(row.months)}`}</Badge>
                      ) : (
                        `${String(row.rentedMonths)} / ${String(row.months)}`
                      )}
                    </Td>
                  </tr>
                ))}
                <tr className="bg-muted font-semibold">
                  <th scope="row" className="h-9 px-2 text-left whitespace-nowrap">
                    Total
                  </th>
                  <Td className="border-b-0 text-caption text-fg-subtle">{`${String(view.totals.lots)} lots`}</Td>
                  <Td numeric strong className="border-b-0">{formatWholeEuros(view.totals.costPrice)}</Td>
                  <Td numeric strong className="border-b-0">{formatWholeEuros(view.totals.rents)}</Td>
                  <Td numeric strong className="border-b-0">{formatWholeEuros(-view.totals.charges)}</Td>
                  <Td numeric strong className="border-b-0">{formatWholeEuros(view.totals.result)}</Td>
                  <Td numeric strong className="border-b-0">{formatPercentValue(view.totals.gross)}</Td>
                  <Td numeric strong className="border-b-0">{formatPercentValue(view.totals.net)}</Td>
                  <Td numeric strong className="border-b-0">{`${String(monthsRate)} %`}</Td>
                </tr>
              </tbody>
            </DataTable>
          )}
        </ChartCard>
      </div>
    </>
  );
}

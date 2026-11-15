'use client';

import { DoorOpen, Landmark, Percent, Receipt } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, Icon, cx } from '@eguardimmo/ui';
import { DataTable, PageHeader, QueryState, Segmented, Switch, Td, Th } from '../kit';
import type { ScreenProps } from '../kit';
import { ChartCard, ChartLegend, GroupedBarChart, LegendItem } from './charts';
import { HORIZONS, buildForecast, lastDayOf } from './compute/forecast';
import type { ForecastResult, Horizon } from './compute/forecast';
import { percentDelta } from './compute/delta';
import { BuildingSelect, FilterBar, FilterLabel, FilterSeparator } from './components/FilterBar';
import { KpiCard } from './components/KpiCard';
import { ScreenActions } from './components/ScreenActions';
import { HypothesesDialog } from './HypothesesDialog';
import { downloadCsv } from './csv';
import type { Cell, Dataset } from './csv';
import { formatDateFr, formatDecimal, formatEuros, formatRoundedEuros, formatWholeEuros } from './format';
import { monthAxisLabel, monthColumnLabel, monthLongLabel } from './months';
import { useAnalytiqueData } from './source';
import type { AnalytiqueData } from './schemas';

interface PrevFilters {
  horizon: Horizon;
  buildingId: string;
  irl: boolean;
  vacancy: boolean;
}

const DEFAULTS: PrevFilters = { horizon: 12, buildingId: 'all', irl: true, vacancy: true };

const HORIZON_OPTIONS = HORIZONS.map((value) => ({ value: String(value), label: `${String(value)} mois` }));

export function AnalytiquePrevPage({ Link }: ScreenProps) {
  const query = useAnalytiqueData();
  const [filters, setFilters] = useState<PrevFilters>(DEFAULTS);
  const [editing, setEditing] = useState(false);
  const result = useMemo(() => (query.data ? buildForecast(query.data, filters) : null), [query.data, filters]);
  const patch = (next: Partial<PrevFilters>) => { setFilters((current) => ({ ...current, ...next })); };

  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Analytique', href: '/analytique' }, { label: 'Prévisionnel' }]}
        title="Prévisionnel de trésorerie"
        description="Projection sur 12 mois à partir de vos baux, de vos échéances et de vos dépenses habituelles."
        actions={
          <ScreenActions
            stamp={query.data?.generatedAt}
            onRefresh={query.refetch}
            onExport={result ? () => { downloadCsv('analytique-previsionnel', tableDataset(result)); } : undefined}
          />
        }
      />
      <QueryState query={query} errorTitle="Le prévisionnel n’a pas pu être chargé">
        {(data) => (
          <>
            <FilterBar onReset={() => { setFilters(DEFAULTS); }}>
              <FilterLabel>Horizon</FilterLabel>
              <Segmented
                label="Horizon"
                options={HORIZON_OPTIONS}
                value={String(filters.horizon)}
                onValueChange={(value) => {
                  const horizon = HORIZONS.find((entry) => String(entry) === value);
                  if (horizon) patch({ horizon });
                }}
              />
              <FilterSeparator />
              <BuildingSelect buildings={data.buildings} value={filters.buildingId} onValueChange={(buildingId) => { patch({ buildingId }); }} />
              <FilterSeparator />
              <Switch label="Indexation IRL" checked={filters.irl} onCheckedChange={(irl) => { patch({ irl }); }} />
              <Switch label="Vacance entre deux baux" checked={filters.vacancy} onCheckedChange={(vacancy) => { patch({ vacancy }); }} />
            </FilterBar>
            {result ? (
              <PrevBody data={data} result={result} filters={filters} onEdit={() => { setEditing(true); }} />
            ) : null}
            {editing ? (
              <HypothesesDialog
                open
                onOpenChange={setEditing}
                current={{ irlBp: data.forecast.irlBp, growthBp: data.forecast.growthBp }}
              />
            ) : null}
          </>
        )}
      </QueryState>
    </>
  );
}

function tableRows(result: ForecastResult): { label: string; values: number[]; total: number; kind: 'plain' | 'negative' | 'balance' | 'cumulative' }[] {
  const sum = (values: readonly number[]) => values.reduce((acc, value) => acc + value, 0);
  const pick = (read: (month: ForecastResult['months'][number]) => number) => result.months.map(read);
  const rows = [
    { label: 'Loyers et charges', values: pick((month) => month.loyers), kind: 'plain' as const },
    { label: 'Autres revenus', values: pick((month) => month.autres), kind: 'plain' as const },
    { label: 'Dépenses récurrentes', values: pick((month) => -month.recurring), kind: 'negative' as const },
    { label: "Échéances d'emprunt", values: pick((month) => -month.loan), kind: 'negative' as const },
    { label: 'Dépenses ponctuelles', values: pick((month) => -month.oneOff), kind: 'negative' as const },
    { label: 'Solde du mois', values: pick((month) => month.balance), kind: 'balance' as const },
  ].map((row) => ({ ...row, total: sum(row.values) }));
  return [
    ...rows,
    { label: 'Trésorerie cumulée', values: pick((month) => month.cumulative), total: result.closingCash, kind: 'cumulative' as const },
  ];
}

function tableDataset(result: ForecastResult): Dataset {
  return {
    columns: ['Poste', ...result.months.map((month) => monthLongLabel(month.month)), 'Total'],
    rows: tableRows(result).map((row): Cell[] => [row.label, ...row.values.map((value) => ({ minor: value })), { minor: row.total }]),
  };
}

const hypothesisDates = (data: AnalytiqueData, buildingId: string): string[] =>
  data.forecast.buildings
    .filter((building) => buildingId === 'all' || building.buildingId === buildingId)
    .flatMap((building) =>
      building.vacancies.map((vacancy) => {
        const lot = data.lots.find((entry) => entry.id === vacancy.lotId)?.name ?? vacancy.lotId;
        const [year = 0, month = 1] = data.forecast.startMonth.split('-').map(Number);
        const from = new Date(Date.UTC(year, month - 1 + vacancy.fromIndex, 1));
        const to = new Date(Date.UTC(year, month + vacancy.toIndex, 0));
        return `${lot} libre du ${formatDateFr(from.toISOString().slice(0, 10))} au ${formatDateFr(to.toISOString().slice(0, 10))}`;
      }),
    );

interface PrevBodyProps {
  data: AnalytiqueData;
  result: ForecastResult;
  filters: PrevFilters;
  onEdit: () => void;
}

function PrevBody({ data, result, filters, onEdit }: PrevBodyProps) {
  const horizonLabel = `${String(filters.horizon)} derniers mois`;
  const closing = result.months.at(-1);
  const sparkOf = (read: (month: ForecastResult['months'][number]) => number) => result.months.map(read);
  const categories = [...result.past, ...result.months].map((entry) => ({ key: entry.month, label: monthAxisLabel(entry.month) }));
  const inflows = [...result.past.map((entry) => entry.inflows), ...result.months.map((entry) => entry.inflows)];
  const outflows = [...result.past.map((entry) => entry.outflows), ...result.months.map((entry) => entry.outflows)];
  const pastCount = result.past.length;
  const firstWithOther = result.months.findIndex((month) => month.autres > 0);

  const tip = (index: number) => {
    const projected = index >= pastCount;
    const month = categories[index]?.key ?? '';
    const extra = projected ? (result.months[index - pastCount]?.autres ?? 0) : 0;
    return {
      title: `${monthLongLabel(month)}${projected ? ', projeté' : ''}`,
      rows: [
        { label: 'Encaissements', value: formatEuros(inflows[index] ?? 0), tone: 'revenue' as const },
        { label: 'Décaissements', value: formatEuros(outflows[index] ?? 0), tone: 'expense' as const },
        ...(extra > 0 ? [{ label: 'dont régularisation', value: `+${formatEuros(extra)}` }] : []),
      ],
    };
  };

  const chartDataset: Dataset = {
    columns: ['Mois', 'Encaissements', 'Décaissements', 'Statut'],
    rows: categories.map((category, index): Cell[] => [
      monthLongLabel(category.key),
      { minor: inflows[index] ?? 0 },
      { minor: outflows[index] ?? 0 },
      index >= pastCount ? 'Projeté' : 'Réalisé',
    ]),
  };

  const hypotheses = hypothesesOf(data, filters);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Encaissements projetés"
          value={formatRoundedEuros(result.inflows)}
          spark={sparkOf((month) => month.inflows)}
          delta={percentDelta(result.inflows, result.reference.inflows, 'up')}
          caption={`vs ${horizonLabel}`}
        />
        <KpiCard
          label="Décaissements projetés"
          value={formatRoundedEuros(result.outflows)}
          spark={sparkOf((month) => month.outflows)}
          sparkTone="expense"
          delta={percentDelta(result.outflows, result.reference.outflows, 'down')}
          caption={`vs ${horizonLabel}`}
        />
        <KpiCard
          label="Solde net projeté"
          value={formatRoundedEuros(result.balance, { signed: true })}
          spark={sparkOf((month) => month.balance)}
          delta={percentDelta(result.balance, result.reference.balance, 'up')}
          caption={`vs ${horizonLabel}`}
        />
        <KpiCard
          label={`Trésorerie au ${closing ? lastDayOf(closing.month) : ''}`}
          value={formatRoundedEuros(result.closingCash)}
          spark={sparkOf((month) => month.cumulative)}
          delta={{ direction: 'flat', tone: 'neutral', text: `depuis ${formatRoundedEuros(result.openingCash)}` }}
        />
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ChartCard
          id="prev-chart"
          title="Encaissements et décaissements"
          dataset={chartDataset}
          csvName="encaissements-et-decaissements"
          legend={
            <ChartLegend>
              <LegendItem tone="revenue">Encaissements</LegendItem>
              <LegendItem tone="expense">Décaissements</LegendItem>
              <LegendItem tone="muted" hatched>
                Projection
              </LegendItem>
            </ChartLegend>
          }
        >
          {() => (
            <GroupedBarChart
              label="Encaissements et décaissements par mois"
              categories={categories}
              series={[
                { key: 'encaissements', tone: 'revenue', values: inflows },
                { key: 'decaissements', tone: 'expense', values: outflows },
              ]}
              tip={tip}
              projectionFrom={pastCount}
              initialActive={pastCount + Math.max(firstWithOther, 0)}
              height={220}
            />
          )}
        </ChartCard>
        <section aria-labelledby="prev-hypotheses" className="flex min-w-0 flex-col gap-2 rounded-lg border border-line bg-surface px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <h2 id="prev-hypotheses" className="text-block-title">
              Hypothèses
            </h2>
            <Button variant="ghost" size="sm" onClick={onEdit}>
              Modifier
            </Button>
          </div>
          <ul className="flex flex-col">
            {hypotheses.map((entry) => (
              <li key={entry.title} className="flex items-start gap-2.5 border-t border-line py-2 first:border-t-0">
                <Icon icon={entry.icon} className="mt-0.5 text-action-on-subtle" />
                <div className="min-w-0 text-body text-fg-muted">
                  <b className="block font-semibold text-fg">{entry.title}</b>
                  {entry.text}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <ChartCard
        id="prev-detail"
        title="Détail mensuel projeté"
        dataset={tableDataset(result)}
        csvName="detail-mensuel-projete"
        note="En euros"
        tableless
      >
        {() => <DetailTable result={result} />}
      </ChartCard>
    </>
  );
}

function hypothesesOf(data: AnalytiqueData, filters: PrevFilters): { icon: LucideIcon; title: string; text: string }[] {
  const dates = hypothesisDates(data, filters.buildingId);
  return [
    filters.irl
      ? { icon: Percent, title: `Indexation IRL, +${formatDecimal(data.forecast.irlBp / 100, 2)} %`, text: 'Appliquée à la date anniversaire de chaque bail.' }
      : { icon: Percent, title: 'Indexation IRL désactivée', text: 'Les loyers restent au niveau actuel.' },
    filters.vacancy
      ? { icon: DoorOpen, title: "Vacance d'un mois par départ", text: dates.length > 0 ? `${dates.join(' ; ')}.` : 'Aucun départ prévu sur cette sélection.' }
      : { icon: DoorOpen, title: 'Aucune vacance entre deux baux', text: 'Chaque lot est reloué sans interruption.' },
    { icon: Receipt, title: 'Dépenses ponctuelles', text: `Moyenne des 24 derniers mois, +${formatDecimal(data.forecast.growthBp / 100, 0)} % par an.` },
    { icon: Landmark, title: 'Taxe foncière en septembre', text: 'Base 2026 revalorisée de 3 %.' },
  ];
}

function DetailTable({ result }: { result: ForecastResult }) {
  const rows = tableRows(result);
  const money = (value: number, kind: string) => formatWholeEuros(value, { signed: kind === 'balance' });
  return (
    <DataTable caption="Détail mensuel projeté, en euros" className="text-fg">
      <thead>
        <tr>
          <Th>Poste</Th>
          {result.months.map((month) => (
            <Th key={month.month} numeric>
              {monthColumnLabel(month.month)}
            </Th>
          ))}
          <Th numeric>Total</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const emphasis = row.kind === 'balance' ? 'font-semibold' : row.kind === 'cumulative' ? 'bg-muted font-semibold' : '';
          return (
            <tr key={row.label} className={emphasis}>
              <th scope="row" className="h-8 border-b border-line px-2 text-left font-[inherit] whitespace-nowrap">
                {row.label}
              </th>
              {row.values.map((value, index) => (
                <Td
                  key={result.months[index]?.month}
                  numeric
                  className={cx('h-8', row.kind === 'negative' && value !== 0 && 'text-fg-danger', value === 0 && 'text-fg-subtle')}
                >
                  {money(value, row.kind)}
                </Td>
              ))}
              <Td numeric strong className="h-8">
                {money(row.total, row.kind)}
              </Td>
            </tr>
          );
        })}
      </tbody>
    </DataTable>
  );
}

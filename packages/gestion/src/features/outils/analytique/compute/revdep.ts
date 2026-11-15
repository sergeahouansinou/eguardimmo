import { EXPENSE_CATEGORIES } from '../constants';
import type { ExpenseCategoryId } from '../constants';
import type { Cell, Dataset } from '../csv';
import { formatPercentValue, formatRoundedEuros, ratioPercent } from '../format';
import { monthColumnLabel, monthLongLabel } from '../months';
import type { AnalytiqueData } from '../schemas';
import { categoryTotals, lotIdsInScope, monthFigures, periodMonths, previousMonths, sumOf } from './aggregate';
import type { Filters, MonthFigures } from './aggregate';
import { percentDelta, pointsDelta } from './delta';
import type { KpiView } from './vue';

export interface HeatRow {
  id: ExpenseCategoryId;
  label: string;
  cells: number[];
  total: number;
}

export interface RevDepView {
  months: string[];
  points: MonthFigures[];
  previous: MonthFigures[];
  kpis: KpiView[];
  sources: { key: string; label: string; amount: number }[];
  recoverable: { key: string; label: string; amount: number }[];
  provisions: number;
  heatRows: HeatRow[];
  heatTotals: number[];
  heatMax: number;
  hasData: boolean;
  exportDataset: Dataset;
}

export function buildRevDep(data: AnalytiqueData, filters: Filters): RevDepView {
  const months = periodMonths(filters.period, filters.from, filters.to);
  const ids = lotIdsInScope(data, filters.buildingId, filters.type);
  const points = monthFigures(data, ids, months);
  const previous = monthFigures(data, ids, previousMonths(months));
  const revenue = sumOf(points, (point) => point.revenus);
  const expenses = sumOf(points, (point) => point.depenses);
  const previousRevenue = sumOf(previous, (point) => point.revenus);
  const previousExpenses = sumOf(previous, (point) => point.depenses);
  const net = revenue - expenses;
  const previousNet = previousRevenue - previousExpenses;
  const chargeRate = ratioPercent(expenses, revenue);
  const previousChargeRate = ratioPercent(previousExpenses, previousRevenue);
  const caption = (previousValue: number) => (filters.compare ? `N-1 : ${formatRoundedEuros(previousValue)}` : null);

  const kpis: KpiView[] = [
    {
      id: 'brut',
      label: 'Revenu brut',
      value: formatRoundedEuros(revenue),
      spark: points.map((point) => point.revenus),
      tone: 'revenue',
      delta: percentDelta(revenue, previousRevenue, 'up'),
      previousText: caption(previousRevenue),
    },
    {
      id: 'depenses',
      label: 'Dépenses',
      value: formatRoundedEuros(expenses),
      spark: points.map((point) => point.depenses),
      tone: 'expense',
      delta: percentDelta(expenses, previousExpenses, 'down'),
      previousText: caption(previousExpenses),
    },
    {
      id: 'net',
      label: 'Résultat net',
      value: formatRoundedEuros(net),
      spark: points.map((point) => point.revenus - point.depenses),
      tone: 'revenue',
      delta: percentDelta(net, previousNet, 'up'),
      previousText: caption(previousNet),
    },
    {
      id: 'charges',
      label: 'Taux de charges',
      value: formatPercentValue(chargeRate),
      spark: [],
      tone: 'expense',
      delta: pointsDelta(chargeRate, previousChargeRate, 'down', 1),
      previousText: null,
    },
  ];

  const totals = categoryTotals(points);
  const heatRows = EXPENSE_CATEGORIES.map((category) => ({
    id: category.id,
    label: category.label,
    cells: points.map((point) => point.byCategory[category.id]),
    total: totals[category.id],
  })).sort((a, b) => b.total - a.total);
  const heatTotals = points.map((point) => point.depenses);
  const recoverable = sumOf(points, (point) => point.recoverable);
  const collectedCharges = sumOf(points, (point) => point.charges);

  return {
    months,
    points,
    previous,
    kpis,
    sources: [
      { key: 'loyers', label: 'Loyers hors charges', amount: sumOf(points, (point) => point.loyers) },
      { key: 'charges', label: 'Charges encaissées', amount: collectedCharges },
      { key: 'autres', label: 'Autres revenus', amount: sumOf(points, (point) => point.autres) },
    ],
    recoverable: [
      { key: 'recuperables', label: 'Récupérables', amount: recoverable },
      { key: 'non-recuperables', label: 'Non récupérables', amount: expenses - recoverable },
    ],
    provisions: collectedCharges - recoverable,
    heatRows,
    heatTotals,
    heatMax: Math.max(0, ...heatRows.flatMap((row) => row.cells)),
    hasData: points.some((point) => point.revenus > 0 || point.depenses > 0),
    exportDataset: {
      columns: filters.compare
        ? ['Mois', 'Revenus', 'Revenus N-1', 'Dépenses', 'Résultat net']
        : ['Mois', 'Revenus', 'Dépenses', 'Résultat net'],
      rows: points.map((point, index) => {
        const row: Cell[] = [monthLongLabel(point.month), { minor: point.revenus }];
        if (filters.compare) row.push({ minor: previous[index]?.revenus ?? 0 });
        row.push({ minor: point.depenses }, { minor: point.revenus - point.depenses });
        return row;
      }),
    },
  };
}

export const heatHeaders = (months: readonly string[]): string[] => months.map(monthColumnLabel);

export const provisionsMessage = (amount: number): string =>
  amount >= 0
    ? `Provisions en trop : ${formatRoundedEuros(amount)} à reverser`
    : `Charges non couvertes : ${formatRoundedEuros(-amount)} à récupérer`;

export const heatBucket = (value: number, max: number): number => {
  if (value <= 0 || max <= 0) return 0;
  const ratio = value / max;
  if (ratio <= 0.12) return 1;
  if (ratio <= 0.25) return 2;
  if (ratio <= 0.4) return 3;
  if (ratio <= 0.7) return 4;
  return 5;
};

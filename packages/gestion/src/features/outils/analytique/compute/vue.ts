import { categoryLabel, EXPENSE_CATEGORIES } from '../constants';
import type { ExpenseCategoryId } from '../constants';
import type { Dataset } from '../csv';
import { formatPercentValue, formatRoundedEuros, ratioPercent } from '../format';
import { monthLongLabel } from '../months';
import type { AnalytiqueData } from '../schemas';
import { averageOccupancy, categoryTotals, lotIdsInScope, monthFigures, occupancyRate, periodMonths, previousMonths, sumOf } from './aggregate';
import type { Filters, MonthFigures } from './aggregate';
import { percentDelta, pointsDelta } from './delta';
import type { Delta } from './delta';
import { arrearsByAge } from './occupation';
import type { AgeBucket } from './occupation';
import type { SeriesTone } from '../charts/tones';

export interface KpiView {
  id: string;
  label: string;
  value: string;
  spark: number[];
  tone: SeriesTone;
  delta: Delta | null;
  previousText: string | null;
}

export interface VueView {
  months: string[];
  points: MonthFigures[];
  previous: MonthFigures[];
  kpis: KpiView[];
  categories: { id: ExpenseCategoryId; label: string; amount: number }[];
  expensesTotal: number;
  occupancy: { month: string; value: number }[];
  arrears: AgeBucket[];
  arrearsTotal: number;
  arrearsTenants: number;
  buildings: { id: string; name: string; amount: number }[];
  topExpenseIndex: number;
  hasData: boolean;
  exportDataset: Dataset;
}

const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);

export function expenseHighlight(point: MonthFigures): { label: string; amount: number } | null {
  if (point.depenses <= 0) return null;
  const entries = (Object.entries(point.byCategory) as [ExpenseCategoryId, number][]).sort((a, b) => b[1] - a[1]);
  const top = entries[0];
  if (!top || top[1] * 2 < point.depenses) return null;
  return { label: `dont ${lowerFirst(categoryLabel(top[0]))}`, amount: top[1] };
}

export function collectionRate(points: readonly MonthFigures[]): number {
  return ratioPercent(sumOf(points, (point) => point.revenus), sumOf(points, (point) => point.appele));
}

export function buildVue(data: AnalytiqueData, filters: Filters): VueView {
  const months = periodMonths(filters.period, filters.from, filters.to);
  const ids = lotIdsInScope(data, filters.buildingId, filters.type);
  const points = monthFigures(data, ids, months);
  const previous = monthFigures(data, ids, previousMonths(months));
  const revenue = sumOf(points, (point) => point.revenus);
  const expenses = sumOf(points, (point) => point.depenses);
  const net = revenue - expenses;
  const previousRevenue = sumOf(previous, (point) => point.revenus);
  const previousExpenses = sumOf(previous, (point) => point.depenses);
  const occupancy = averageOccupancy(points, true);
  const previousOccupancy = averageOccupancy(previous, true);
  const collection = collectionRate(points);
  const previousCollection = collectionRate(previous);
  const flag = (previousValue: number, formatter: (amount: number) => string) =>
    filters.compare ? `N-1 : ${formatter(previousValue)}` : null;

  const kpis: KpiView[] = [
    {
      id: 'revenus',
      label: 'Revenus encaissés',
      value: formatRoundedEuros(revenue),
      spark: points.map((point) => point.revenus),
      tone: 'revenue',
      delta: percentDelta(revenue, previousRevenue, 'up'),
      previousText: flag(previousRevenue, formatRoundedEuros),
    },
    {
      id: 'depenses',
      label: 'Dépenses',
      value: formatRoundedEuros(expenses),
      spark: points.map((point) => point.depenses),
      tone: 'expense',
      delta: percentDelta(expenses, previousExpenses, 'down'),
      previousText: flag(previousExpenses, formatRoundedEuros),
    },
    {
      id: 'cashflow',
      label: 'Cash-flow net',
      value: formatRoundedEuros(net),
      spark: points.map((point) => point.revenus - point.depenses),
      tone: 'revenue',
      delta: percentDelta(net, previousRevenue - previousExpenses, 'up'),
      previousText: flag(previousRevenue - previousExpenses, formatRoundedEuros),
    },
    {
      id: 'occupation',
      label: 'Occupation moyenne',
      value: formatPercentValue(Math.round(occupancy), 0),
      spark: points.map((point) => occupancyRate(point, true)),
      tone: 'revenue',
      delta: pointsDelta(occupancy, previousOccupancy, 'up'),
      previousText: flag(previousOccupancy, (value) => formatPercentValue(Math.round(value), 0)),
    },
    {
      id: 'encaissement',
      label: "Taux d'encaissement",
      value: formatPercentValue(Math.round(collection), 0),
      spark: points.map((point) => ratioPercent(point.revenus, point.appele)),
      tone: 'revenue',
      delta: pointsDelta(collection, previousCollection, 'up'),
      previousText: flag(previousCollection, (value) => formatPercentValue(Math.round(value), 0)),
    },
  ];

  const totals = categoryTotals(points);
  const categories = EXPENSE_CATEGORIES.map((category) => ({ id: category.id, label: category.label, amount: totals[category.id] })).sort(
    (a, b) => b.amount - a.amount,
  );

  const allIds = lotIdsInScope(data, 'all', filters.type);
  const buildings = data.buildings
    .map((building) => {
      const lotIds = new Set(data.lots.filter((lot) => lot.buildingId === building.id && allIds.has(lot.id)).map((lot) => lot.id));
      return { id: building.id, name: building.name, amount: sumOf(monthFigures(data, lotIds, months), (point) => point.revenus) };
    })
    .sort((a, b) => b.amount - a.amount);

  const arrears = data.arrears.filter((entry) => ids.has(entry.lotId));
  const topExpenseIndex = points.reduce((best, point, index) => (point.depenses > (points[best]?.depenses ?? 0) ? index : best), 0);

  return {
    months,
    points,
    previous,
    kpis,
    categories,
    expensesTotal: expenses,
    occupancy: points.map((point) => ({ month: point.month, value: occupancyRate(point, true) })),
    arrears: arrearsByAge(arrears),
    arrearsTotal: arrears.reduce((acc, entry) => acc + entry.amount, 0),
    arrearsTenants: new Set(arrears.map((entry) => entry.tenant)).size,
    buildings,
    topExpenseIndex,
    hasData: points.some((point) => point.revenus > 0 || point.depenses > 0),
    exportDataset: {
      columns: ['Mois', 'Revenus', 'Dépenses', 'Cash-flow net', "Taux d'occupation (%)", "Taux d'encaissement (%)"],
      rows: points.map((point) => [
        monthLongLabel(point.month),
        { minor: point.revenus },
        { minor: point.depenses },
        { minor: point.revenus - point.depenses },
        Math.round(occupancyRate(point, true) * 10) / 10,
        Math.round(ratioPercent(point.revenus, point.appele) * 10) / 10,
      ]),
    },
  };
}

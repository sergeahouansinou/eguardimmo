import type { ExpenseCategoryId } from '../constants';
import { EXPENSE_CATEGORY_IDS, WINDOW_END, WINDOW_START } from '../constants';
import { addMonths, monthRange } from '../months';
import type { AnalytiqueData } from '../schemas';

export type PeriodKey = '3m' | '12m' | 'year' | 'custom';

export interface Filters {
  period: PeriodKey;
  from: string;
  to: string;
  buildingId: string;
  type: string;
  compare: boolean;
}

export const DEFAULT_FILTERS: Filters = {
  period: '12m',
  from: WINDOW_START,
  to: WINDOW_END,
  buildingId: 'all',
  type: 'all',
  compare: false,
};

export function periodMonths(period: PeriodKey, from: string, to: string): string[] {
  switch (period) {
    case '3m':
      return monthRange(addMonths(WINDOW_END, -2), WINDOW_END);
    case '12m':
      return monthRange(WINDOW_START, WINDOW_END);
    case 'year':
      return monthRange('2026-01', WINDOW_END);
    case 'custom': {
      const start = from < WINDOW_START ? WINDOW_START : from;
      const end = to > WINDOW_END ? WINDOW_END : to;
      return monthRange(start, end < start ? start : end);
    }
  }
}

export const previousMonths = (months: readonly string[]): string[] => months.map((month) => addMonths(month, -12));

export function lotIdsInScope(data: AnalytiqueData, buildingId: string, type: string): Set<string> {
  return new Set(
    data.lots
      .filter((lot) => (buildingId === 'all' || lot.buildingId === buildingId) && (type === 'all' || lot.type === type))
      .map((lot) => lot.id),
  );
}

export interface MonthFigures {
  month: string;
  loyers: number;
  charges: number;
  autres: number;
  revenus: number;
  appele: number;
  depenses: number;
  recoverable: number;
  byCategory: Record<ExpenseCategoryId, number>;
  lots: number;
  rented: number;
  vacant: number;
  works: number;
}

function emptyCategories(): Record<ExpenseCategoryId, number> {
  return Object.fromEntries(EXPENSE_CATEGORY_IDS.map((id) => [id, 0])) as Record<ExpenseCategoryId, number>;
}

export function monthFigures(data: AnalytiqueData, lotIds: ReadonlySet<string>, months: readonly string[]): MonthFigures[] {
  const byMonth = new Map<string, MonthFigures>(months.map((month) => [month, emptyPoint(month)]));
  for (const revenue of data.revenues) {
    const point = byMonth.get(revenue.month);
    if (!point || !lotIds.has(revenue.lotId)) continue;
    point.loyers += revenue.loyers;
    point.charges += revenue.charges;
    point.autres += revenue.autres;
    point.revenus += revenue.loyers + revenue.charges + revenue.autres;
    point.appele += revenue.called;
  }
  for (const expense of data.expenses) {
    const point = byMonth.get(expense.month);
    if (!point || !lotIds.has(expense.lotId)) continue;
    point.depenses += expense.amount;
    point.recoverable += expense.recoverable;
    point.byCategory[expense.category] += expense.amount;
  }
  for (const cell of data.occupancy) {
    const point = byMonth.get(cell.month);
    if (!point || !lotIds.has(cell.lotId)) continue;
    point.lots += 1;
    if (cell.status === 'O' || cell.status === 'P') point.rented += 1;
    else if (cell.status === 'V') point.vacant += 1;
    else point.works += 1;
  }
  return months.map((month) => byMonth.get(month) ?? emptyPoint(month));
}

function emptyPoint(month: string): MonthFigures {
  return {
    month,
    loyers: 0,
    charges: 0,
    autres: 0,
    revenus: 0,
    appele: 0,
    depenses: 0,
    recoverable: 0,
    byCategory: emptyCategories(),
    lots: 0,
    rented: 0,
    vacant: 0,
    works: 0,
  };
}

export const sumOf = (points: readonly MonthFigures[], pick: (point: MonthFigures) => number): number =>
  points.reduce((acc, point) => acc + pick(point), 0);

export function occupancyDenominator(point: MonthFigures, worksAsVacancy: boolean): number {
  return worksAsVacancy ? point.lots : point.lots - point.works;
}

export function occupancyRate(point: MonthFigures, worksAsVacancy: boolean): number {
  const denominator = occupancyDenominator(point, worksAsVacancy);
  return denominator <= 0 ? 0 : (point.rented / denominator) * 100;
}

export function averageOccupancy(points: readonly MonthFigures[], worksAsVacancy: boolean): number {
  const rented = sumOf(points, (point) => point.rented);
  const denominator = sumOf(points, (point) => occupancyDenominator(point, worksAsVacancy));
  return denominator <= 0 ? 0 : (rented / denominator) * 100;
}

export function categoryTotals(points: readonly MonthFigures[]): Record<ExpenseCategoryId, number> {
  const totals = emptyCategories();
  for (const point of points) for (const id of EXPENSE_CATEGORY_IDS) totals[id] += point.byCategory[id];
  return totals;
}

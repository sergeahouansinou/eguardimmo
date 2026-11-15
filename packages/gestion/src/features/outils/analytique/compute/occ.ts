import { ratioPercent } from '../format';
import type { Dataset } from '../csv';
import { OCCUPANCY_LABELS } from '../constants';
import { monthColumnLabel } from '../months';
import type { AnalytiqueData } from '../schemas';
import { averageOccupancy, lotIdsInScope, monthFigures, occupancyRate, periodMonths, previousMonths, sumOf } from './aggregate';
import type { Filters, MonthFigures } from './aggregate';
import { pointsDelta } from './delta';
import type { Delta } from './delta';
import { buildPlanning, upcomingLeaseEnds, vacancyStats } from './occupation';
import type { LeaseEndRow, PlanningRow, VacancyStats } from './occupation';

export interface OccFilters extends Filters {
  works: boolean;
}

export interface OccView {
  months: string[];
  points: MonthFigures[];
  rows: PlanningRow[];
  current: { rate: number; rented: number; total: number };
  average: number;
  averageDelta: Delta;
  stats: VacancyStats;
  unearnedShare: number;
  leaseEnds: LeaseEndRow[];
  line: { month: string; value: number }[];
  hasData: boolean;
  exportDataset: Dataset;
}

export function buildOccupation(data: AnalytiqueData, filters: OccFilters): OccView {
  const months = periodMonths(filters.period, filters.from, filters.to);
  const ids = lotIdsInScope(data, filters.buildingId, filters.type);
  const points = monthFigures(data, ids, months);
  const previous = monthFigures(data, ids, previousMonths(months));
  const rows = buildPlanning(data, ids, months);
  const last = points.at(-1);
  const total = last ? last.lots - (filters.works ? 0 : last.works) : 0;
  const average = averageOccupancy(points, filters.works);
  const stats = vacancyStats(rows, filters.works);
  const revenue = sumOf(points, (point) => point.revenus);
  return {
    months,
    points,
    rows,
    current: { rate: last ? occupancyRate(last, filters.works) : 0, rented: last?.rented ?? 0, total },
    average,
    averageDelta: pointsDelta(average, averageOccupancy(previous, filters.works), 'up'),
    stats,
    unearnedShare: ratioPercent(stats.unearned, revenue),
    leaseEnds: upcomingLeaseEnds(data, ids),
    line: points.map((point) => ({ month: point.month, value: occupancyRate(point, filters.works) })),
    hasData: rows.length > 0,
    exportDataset: {
      columns: ['Lot', 'Immeuble', ...months.map(monthColumnLabel), 'Loués'],
      rows: rows.map((row) => [
        row.lot.name,
        row.buildingName,
        ...row.cells.map((cell) => OCCUPANCY_LABELS[cell.status]),
        `${String(row.rented)} / ${String(row.cells.length)}`,
      ]),
    },
  };
}

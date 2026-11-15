import { daysBetween, formatSpan } from './dates';
import { occupancyRate, periodDays } from './timeline';
import type { OccupationData } from '../schemas/lots';

export interface OccupationStats {
  tenants: number;
  leases: number;
  averageLease: string | null;
  vacancy: string;
  rate: number;
  rentChange: { percent: number; since: number } | null;
}

export function occupationStats(data: Pick<OccupationData, 'periods' | 'rentSteps' | 'asOf'>): OccupationStats {
  const leases = data.periods.filter((period) => period.kind === 'bail');
  const ended = leases.filter((period) => period.endDate !== null);
  const average = ended.length === 0 ? null : ended.reduce((sum, period) => sum + periodDays(period, data.asOf), 0) / ended.length;
  const vacancyDays = data.periods
    .filter((period) => period.kind === 'vacance')
    .reduce((sum, period) => sum + Math.max(0, daysBetween(period.startDate, period.endDate ?? data.asOf)), 0);
  const first = data.rentSteps[0];
  const last = data.rentSteps.at(-1);
  const rentChange =
    first && last && first.rent > 0 && first !== last ? { percent: Math.round(((last.rent - first.rent) / first.rent) * 1000) / 10, since: first.year } : null;
  return {
    tenants: new Set(leases.map((period) => period.occupant?.id ?? period.id)).size,
    leases: leases.length,
    averageLease: average === null ? null : formatSpan(Math.round(average)),
    vacancy: formatSpan(vacancyDays),
    rate: occupancyRate(data.periods, data.asOf),
    rentChange,
  };
}

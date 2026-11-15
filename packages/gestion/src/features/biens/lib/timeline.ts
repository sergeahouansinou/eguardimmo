import { daysBetween } from './dates';

export interface OccupationPeriod {
  id: string;
  kind: 'bail' | 'vacance';
  startDate: string;
  endDate: string | null;
}

export interface TimelineSegment<P extends OccupationPeriod> {
  period: P;
  days: number;
  share: number;
}

function effectiveEnd(period: OccupationPeriod, asOf: string): string {
  return period.endDate !== null && period.endDate < asOf ? period.endDate : asOf;
}

export function periodDays(period: OccupationPeriod, asOf: string): number {
  return Math.max(1, daysBetween(period.startDate, effectiveEnd(period, asOf)) + 1);
}

export function buildTimeline<P extends OccupationPeriod>(periods: readonly P[], asOf: string): TimelineSegment<P>[] {
  const ordered = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const total = ordered.reduce((sum, period) => sum + periodDays(period, asOf), 0);
  return ordered.map((period) => {
    const days = periodDays(period, asOf);
    return { period, days, share: total === 0 ? 0 : days / total };
  });
}

export function occupancyRate(periods: readonly OccupationPeriod[], asOf: string): number {
  const total = periods.reduce((sum, period) => sum + periodDays(period, asOf), 0);
  if (total === 0) return 0;
  const leased = periods.filter((period) => period.kind === 'bail').reduce((sum, period) => sum + periodDays(period, asOf), 0);
  return Math.round((leased / total) * 100);
}

export function yearTicks(periods: readonly OccupationPeriod[], asOf: string): { label: string; share: number }[] {
  const first = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate))[0]?.startDate;
  if (!first) return [];
  const total = daysBetween(first, asOf);
  if (total <= 0) return [];
  const startYear = Number(first.slice(0, 4));
  const endYear = Number(asOf.slice(0, 4));
  const step = endYear - startYear > 6 ? 2 : 1;
  const ticks: { label: string; share: number }[] = [];
  for (let year = startYear + 1; year < endYear; year += step) {
    const share = daysBetween(first, `${String(year)}-01-01`) / total;
    if (share > 0.06 && share < 0.94) ticks.push({ label: String(year), share });
  }
  return ticks;
}

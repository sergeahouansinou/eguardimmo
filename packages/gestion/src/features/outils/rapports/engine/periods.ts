import { PERIODS } from '../loyers';
import type { PeriodSpec } from './types';

function lastDay(month: string): string {
  const [year = 0, mon = 1] = month.split('-').map(Number);
  return new Date(Date.UTC(year, mon, 0)).toISOString().slice(0, 10);
}

const display = (iso: string): string => iso.split('-').reverse().join('/');

function make(key: string, label: string, from: string, to: string, title: string): PeriodSpec {
  const fromDate = `${from}-01`;
  const toDate = lastDay(to);
  return { key, label, from, to, fromDate, toDate, start: display(fromDate), end: display(toDate), title };
}

const past = (key: 'year2026' | 'last3' | 'month' | 'year2025'): PeriodSpec => {
  const spec = PERIODS[key];
  return make(key, spec.label, spec.from, spec.to, spec.title);
};

export const PAST_PERIODS: readonly PeriodSpec[] = [past('year2026'), past('last3'), past('month'), past('year2025')];

export const YEAR_PERIODS: readonly PeriodSpec[] = [past('year2026'), past('year2025')];

export const FUTURE_PERIODS: readonly PeriodSpec[] = [
  make('next12', '12 prochains mois', '2026-12', '2027-11', 'décembre 2026 à novembre 2027'),
  make('next3', '3 prochains mois', '2026-12', '2027-02', 'décembre 2026 à février 2027'),
  make('year2027', 'Année 2027', '2027-01', '2027-12', '2027'),
];

export const SNAPSHOT_PERIOD: PeriodSpec = make('snapshot', 'Situation à date', '2026-11', '2026-11', 'situation au 13/11/2026');

export function inPeriod(iso: string, period: PeriodSpec): boolean {
  return iso >= period.fromDate && iso <= period.toDate;
}

export function monthInPeriod(month: string, period: PeriodSpec): boolean {
  return month >= period.from && month <= period.to;
}

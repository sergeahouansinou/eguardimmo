import { formatMonthLong, formatMonthShort } from '../../../format/dates';

export function addMonths(month: string, delta: number): string {
  const [year = 0, mon = 1] = month.split('-').map(Number);
  const index = year * 12 + (mon - 1) + delta;
  return `${String(Math.floor(index / 12))}-${String((index % 12) + 1).padStart(2, '0')}`;
}

export function monthRange(from: string, to: string): string[] {
  const result: string[] = [];
  for (let month = from; month <= to; month = addMonths(month, 1)) result.push(month);
  return result;
}

export const monthAxisLabel = (month: string): string => formatMonthShort(month);

export function monthColumnLabel(month: string): string {
  return `${formatMonthShort(month)} ${month.slice(2, 4)}`;
}

export const monthLongLabel = (month: string): string => formatMonthLong(month);

export function monthLongLowerLabel(month: string): string {
  return formatMonthLong(month).toLowerCase();
}

import { formatMonth } from "../format";

export const MONTH_PATTERN = /^(19|20)\d{2}-(0[1-9]|1[0-2])$/;

export function currentMonth(now: Date = new Date()): string {
  return `${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function recentMonths(now: Date = new Date(), count = 12): string[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    return `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
}

export function monthOptions(selected: string, now: Date = new Date()): { value: string; label: string }[] {
  const months = recentMonths(now);
  if (!months.includes(selected)) months.push(selected);
  return months.map((value) => ({ value, label: formatMonth(value) }));
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

interface DateParts {
  year: number;
  month: number;
  day: number;
}

export function parseIso(iso: string): DateParts {
  const match = ISO.exec(iso);
  if (!match) throw new RangeError(`Date invalide : ${iso}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function toTime(iso: string): number {
  const { year, month, day } = parseIso(iso);
  return Date.UTC(year, month - 1, day);
}

function fromTime(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

export function isValidIsoDate(value: string): boolean {
  if (!ISO.test(value)) return false;
  return fromTime(toTime(value)) === value;
}

export const addDays = (iso: string, days: number): string => fromTime(toTime(iso) + days * DAY_MS);

export const diffDays = (from: string, to: string): number => Math.round((toTime(to) - toTime(from)) / DAY_MS);

export const yearMonthOf = (iso: string): string => iso.slice(0, 7);

export function daysInMonth(yearMonth: string): number {
  const { year, month } = parseIso(`${yearMonth}-01`);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addMonths(yearMonth: string, months: number): string {
  const { year, month } = parseIso(`${yearMonth}-01`);
  const index = year * 12 + (month - 1) + months;
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
}

export function addMonthsClamped(iso: string, months: number): string {
  const { day } = parseIso(iso);
  const target = addMonths(yearMonthOf(iso), months);
  return `${target}-${String(Math.min(day, daysInMonth(target))).padStart(2, '0')}`;
}

export function weekdayIndex(iso: string): number {
  return (new Date(toTime(iso)).getUTCDay() + 6) % 7;
}

export function monthWeeks(yearMonth: string): string[][] {
  const first = `${yearMonth}-01`;
  const last = `${yearMonth}-${String(daysInMonth(yearMonth)).padStart(2, '0')}`;
  const start = addDays(first, -weekdayIndex(first));
  const end = addDays(last, 6 - weekdayIndex(last));
  const weeks: string[][] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, offset) => addDays(cursor, offset)));
  }
  return weeks;
}

export function formatFrDate(iso: string): string {
  const { year, month, day } = parseIso(iso);
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${String(year)}`;
}

export function formatDayMonthShort(iso: string): string {
  return formatFrDate(iso).slice(0, 5);
}

export function formatDayHeading(iso: string): string {
  const text = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(toTime(iso)),
  );
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatMonthTitle(yearMonth: string): string {
  const text = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(toTime(`${yearMonth}-01`)),
  );
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatDayLabel(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(toTime(iso)),
  );
}

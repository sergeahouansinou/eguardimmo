import { MAX_RANGE_DAYS } from '../model';

export const AGENDA_VIEWS = ['mois', 'semaine', 'jour'] as const;
export type AgendaView = (typeof AGENDA_VIEWS)[number];

export interface DateRange {
  from: string;
  to: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const NOON = 'T12:00:00Z';

export function isIsoDate(value: string | null | undefined): value is string {
  if (!value || !ISO_DATE.test(value)) return false;
  return new Date(`${value}${NOON}`).toISOString().slice(0, 10) === value;
}

export function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}${NOON}`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function addMonthsIso(iso: string, months: number): string {
  const [year = 0, month = 1, day = 1] = iso.split('-').map(Number);
  const total = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(total / 12);
  const targetMonth = total % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

export function daysBetweenIso(from: string, to: string): number {
  return Math.round((new Date(`${to}${NOON}`).getTime() - new Date(`${from}${NOON}`).getTime()) / 86_400_000);
}

export function isoWeekday(iso: string): number {
  const day = new Date(`${iso}${NOON}`).getUTCDay();
  return day === 0 ? 7 : day;
}

export function startOfWeek(iso: string): string {
  return addDaysIso(iso, 1 - isoWeekday(iso));
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function viewRange(view: AgendaView, anchor: string): DateRange {
  if (view === 'jour') return { from: anchor, to: addDaysIso(anchor, 1) };
  if (view === 'semaine') {
    const from = startOfWeek(anchor);
    return { from, to: addDaysIso(from, 7) };
  }
  const from = startOfWeek(startOfMonth(anchor));
  const monthEnd = addMonthsIso(startOfMonth(anchor), 1);
  const to = addDaysIso(startOfWeek(addDaysIso(monthEnd, -1)), 7);
  return { from, to };
}

export function rangeDays(range: DateRange): string[] {
  const days: string[] = [];
  for (let day = range.from; day < range.to; day = addDaysIso(day, 1)) days.push(day);
  return days;
}

export function isRangeAllowed(range: DateRange): boolean {
  const length = daysBetweenIso(range.from, range.to);
  return length > 0 && length <= MAX_RANGE_DAYS;
}

export function shiftAnchor(view: AgendaView, anchor: string, direction: 1 | -1): string {
  if (view === 'jour') return addDaysIso(anchor, direction);
  if (view === 'semaine') return addDaysIso(anchor, 7 * direction);
  return addMonthsIso(startOfMonth(anchor), direction);
}

export function isAgendaView(value: string | null | undefined): value is AgendaView {
  return AGENDA_VIEWS.some((view) => view === value);
}

const label = (iso: string, options: Intl.DateTimeFormatOptions): string => new Intl.DateTimeFormat('fr-FR', { ...options, timeZone: 'UTC' }).format(new Date(`${iso}${NOON}`));

const capitalized = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

export const longDayLabel = (iso: string): string => label(iso, { weekday: 'long', day: 'numeric', month: 'long' });
export const fullDayLabel = (iso: string): string => capitalized(label(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
export const weekdayShort = (iso: string): string => label(iso, { weekday: 'short' });
export const dayNumber = (iso: string): string => label(iso, { day: 'numeric' });

export function periodLabel(view: AgendaView, anchor: string): string {
  if (view === 'jour') return fullDayLabel(anchor);
  if (view === 'mois') return capitalized(label(anchor, { month: 'long', year: 'numeric' }));
  const { from, to } = viewRange(view, anchor);
  const last = addDaysIso(to, -1);
  const sameMonth = from.slice(0, 7) === last.slice(0, 7);
  const start = label(from, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'long' });
  return `Semaine du ${start} au ${label(last, { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

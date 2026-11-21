const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'] as const;
const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

function parts(iso: string): { year: number; month: number; day: number } {
  const match = ISO_DATE.exec(iso);
  if (!match) throw new RangeError(`Date invalide : ${iso}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function toUtc(iso: string): number {
  const { year, month, day } = parts(iso);
  return Date.UTC(year, month - 1, day);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function todayIso(now: Date = new Date()): string {
  return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function formatDate(iso: string): string {
  const { year, month, day } = parts(iso);
  return `${pad(day)}/${pad(month)}/${String(year)}`;
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)}, ${formatTime(iso)}`;
}

export function formatTime(iso: string): string {
  return iso.slice(11, 16);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((toUtc(toIso) - toUtc(fromIso)) / 86_400_000);
}

export function addMonths(iso: string, months: number): string {
  const { year, month, day } = parts(iso);
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = (index % 12) + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  return `${String(targetYear)}-${pad(targetMonth)}-${pad(Math.min(day, lastDay))}`;
}

export function addDays(iso: string, days: number): string {
  const date = new Date(toUtc(iso) + days * 86_400_000);
  return `${String(date.getUTCFullYear())}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function monthName(isoOrMonth: string): string {
  const { month } = parts(isoOrMonth.length === 7 ? `${isoOrMonth}-01` : isoOrMonth);
  return MONTHS[month - 1] ?? '';
}

export function formatMonthYear(isoOrMonth: string): string {
  const { year } = parts(isoOrMonth.length === 7 ? `${isoOrMonth}-01` : isoOrMonth);
  const name = monthName(isoOrMonth);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${String(year)}`;
}

export function formatWeekdayDate(iso: string): string {
  const weekday = WEEKDAYS[new Date(toUtc(iso)).getUTCDay()] ?? '';
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${formatDate(iso)}`;
}

export function yearOf(iso: string): number {
  return parts(iso).year;
}

export function plural(count: number, singular: string, pluralForm: string): string {
  return `${String(count)} ${count > 1 ? pluralForm : singular}`;
}

export function monthOf(isoOrMonth: string): string {
  const name = monthName(isoOrMonth);
  return /^[aeiouéèh]/.test(name) ? `d'${name}` : `de ${name}`;
}

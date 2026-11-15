const PARIS = 'Europe/Paris';

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: PARIS,
});
const timeFormat = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: PARIS,
});
const dayMonthFormat = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', timeZone: PARIS });
const integerFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function toDate(value: string): Date {
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(date.getTime())) throw new RangeError(`Date invalide : ${value}`);
  return date;
}

export const formatDate = (value: string): string => dateFormat.format(toDate(value));
export const formatTime = (value: string): string => timeFormat.format(toDate(value));
export const formatDayMonth = (value: string): string => dayMonthFormat.format(toDate(value));
export const formatDateTime = (value: string): string => `${formatDate(value)}, ${formatTime(value)}`;
export const formatInteger = (value: number): string => integerFormat.format(value);
export const formatDecimal = (value: number): string => decimalFormat.format(value);

export function dayKey(value: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: PARIS }).format(toDate(value));
}

export function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${dayKey(from)}T00:00:00Z`);
  const end = Date.parse(`${dayKey(to)}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

export function formatEuros(minor: number, { decimals = 'auto' }: { decimals?: 'auto' | 'always' } = {}): string {
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const whole = Math.trunc(abs / 100);
  const cents = abs % 100;
  const showCents = decimals === 'always' || cents !== 0;
  const text = `${integerFormat.format(whole)}${showCents ? `,${String(cents).padStart(2, '0')}` : ''}`;
  return `${negative ? '-' : ''}${text} €`;
}

export function parseEurosToMinor(text: string): number | null {
  const cleaned = text.replace(/[\s\u00a0\u202f€]/g, '');
  const match = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const whole = Number(match[1]);
  const cents = Number((match[2] ?? '').padEnd(2, '0'));
  return whole * 100 + cents;
}

export function minorToInput(minor: number): string {
  const whole = Math.trunc(minor / 100);
  const cents = minor % 100;
  return cents === 0 ? String(whole) : `${String(whole)},${String(cents).padStart(2, '0')}`;
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${formatInteger(count)} ${count > 1 ? pluralForm : singular}`;
}

export function formatStorage(megabytes: number): string {
  if (megabytes < 1000) return `${formatInteger(megabytes)} Mo`;
  const gigabytes = megabytes / 1000;
  return `${Number.isInteger(gigabytes) ? formatInteger(gigabytes) : formatDecimal(gigabytes)} Go`;
}

export function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : (parts[0]?.[1] ?? '');
  return `${first}${second}`.toUpperCase();
}

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const percentBpFormat = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatPercentBp(basisPoints: number): string {
  return `${percentBpFormat.format(basisPoints / 100)} %`;
}

export function formatDurationMinutes(minutes: number): string {
  if (minutes < 60) return `${formatInteger(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${formatInteger(hours)} h` : `${formatInteger(hours)} h ${String(rest).padStart(2, '0')}`;
}

const dateTimeSecondsFormat = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  timeZone: PARIS,
});

export function formatDateTimeSeconds(value: string): string {
  return dateTimeSecondsFormat.format(toDate(value));
}

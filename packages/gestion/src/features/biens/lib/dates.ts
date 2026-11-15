const DAY_MS = 86_400_000;

export function toUtc(iso: string): number {
  const time = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(time)) throw new RangeError(`Date invalide : ${iso}`);
  return time;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

export function addDays(iso: string, days: number): string {
  return new Date(toUtc(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

export function formatDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-');
  return `${day ?? ''}/${month ?? ''}/${year ?? ''}`;
}

export function formatMonthYear(iso: string): string {
  const [year, month] = iso.slice(0, 10).split('-');
  return `${month ?? ''}/${year ?? ''}`;
}

const MONTH_DAYS = 30.4375;

function decimal(value: number): string {
  return String(value).replace('.', ',');
}

export function formatSpan(days: number): string {
  if (days < 45) return `${String(days)} jour${days > 1 ? 's' : ''}`;
  const months = days / MONTH_DAYS;
  if (months < 12) {
    const half = Math.round(months * 2) / 2;
    return `${decimal(half)} mois`;
  }
  const whole = Math.round(months);
  const years = Math.floor(whole / 12);
  const rest = whole % 12;
  const yearText = `${String(years)} an${years > 1 ? 's' : ''}`;
  return rest === 0 ? yearText : `${yearText} ${String(rest)} mois`;
}

export function formatDuration(from: string, to: string): string {
  return formatSpan(Math.max(0, daysBetween(from, to)));
}

export function monthsBetween(from: string, to: string): number {
  return Math.max(0, Math.round(daysBetween(from, to) / MONTH_DAYS));
}

export function addMonths(iso: string, months: number): string {
  const [year = 0, month = 1, day = 1] = iso.slice(0, 10).split('-').map(Number);
  const total = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(total / 12);
  const targetMonth = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const text = (value: number, width = 2) => String(value).padStart(width, '0');
  return `${text(targetYear, 4)}-${text(targetMonth)}-${text(Math.min(day, lastDay))}`;
}

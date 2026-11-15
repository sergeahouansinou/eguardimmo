const pad = (value: number) => String(value).padStart(2, '0');

function parts(iso: string): [number, number, number] {
  const [year = 0, month = 0, day = 0] = iso.slice(0, 10).split('-').map(Number);
  return [year, month, day];
}

export function formatDate(iso: string): string {
  const [year, month, day] = parts(iso);
  return `${pad(day)}/${pad(month)}/${String(year)}`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const text = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  }).format(date);
  return text.replace(',', '');
}

export function formatMonthYear(yearMonth: string): string {
  const [year, month] = parts(`${yearMonth}-01`);
  return `${pad(month)}/${String(year)}`;
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

export function monthNameOf(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' }).format(new Date(`${iso.slice(0, 7)}-15T12:00:00Z`));
}

export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = parts(from);
  const [ty, tm, td] = parts(to);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

export function addMonths(iso: string, count: number): string {
  const [year, month, day] = parts(iso);
  const index = year * 12 + (month - 1) + count;
  const targetYear = Math.floor(index / 12);
  const targetMonth = (index % 12) + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  return `${String(targetYear)}-${pad(targetMonth)}-${pad(Math.min(day, lastDay))}`;
}

export function addDays(iso: string, count: number): string {
  const [year, month, day] = parts(iso);
  const date = new Date(Date.UTC(year, month - 1, day + count));
  return `${String(date.getUTCFullYear())}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return addDays(value, 0) === value;
}

export function parseFrenchDate(text: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!match) return null;
  const iso = `${match[3] ?? ''}-${match[2] ?? ''}-${match[1] ?? ''}`;
  return isIsoDate(iso) ? iso : null;
}

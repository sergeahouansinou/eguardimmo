const PARIS = 'Europe/Paris';

function parse(iso: string): Date {
  const date = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(date.getTime())) throw new RangeError(`Date invalide : ${iso}`);
  return date;
}

export function formatLongDate(iso: string, timeZone = PARIS): string {
  const text = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone,
  }).format(parse(iso));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatDayMonth(iso: string, timeZone = PARIS): string {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', timeZone }).format(parse(iso));
}

export function formatMonthShort(yearMonth: string): string {
  return new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' }).format(parse(`${yearMonth}-15`));
}

export function formatMonthLong(yearMonth: string): string {
  const text = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    parse(`${yearMonth}-15`),
  );
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function monthName(iso: string, timeZone = PARIS): string {
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone }).format(parse(iso));
}

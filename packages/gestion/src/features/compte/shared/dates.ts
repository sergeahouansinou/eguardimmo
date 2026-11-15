const PARIS = 'Europe/Paris';

function parse(iso: string): Date {
  const date = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(date.getTime())) throw new RangeError(`Date invalide : ${iso}`);
  return date;
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: PARIS }).format(parse(iso));
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: PARIS }).format(parse(iso));
}

export function formatDateTimeOffset(iso: string): string {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZone: PARIS,
    timeZoneName: 'shortOffset',
  }).formatToParts(parse(iso));
  const offset = parts.find((part) => part.type === 'timeZoneName')?.value ?? '';
  const time = parts
    .filter((part) => part.type === 'hour' || part.type === 'minute' || part.type === 'second' || part.type === 'literal')
    .map((part) => part.value)
    .join('')
    .trim();
  return `${formatDate(iso)} ${time} ${offset.replace('GMT', 'UTC')}`;
}

export function isoDay(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: PARIS }).format(parse(iso));
}

export function formatDay(day: string): string {
  const [year, month, date] = day.split('-');
  return `${date ?? ''}/${month ?? ''}/${year ?? ''}`;
}

export function addDays(day: string, delta: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

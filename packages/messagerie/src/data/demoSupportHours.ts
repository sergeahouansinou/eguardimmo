const PARIS = 'Europe/Paris';
const OPENING_HOUR = 9;
const CLOSING_HOUR = 18;

export function isDemoSupportOnline(now: Date): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: PARIS,
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const weekday = parts.find((part) => part.type === 'weekday')?.value;
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  if (weekday === 'Sat' || weekday === 'Sun') return false;
  return hour >= OPENING_HOUR && hour < CLOSING_HOUR;
}

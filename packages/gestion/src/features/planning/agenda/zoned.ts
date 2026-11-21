const partsOf = (instant: number, timeZone: string): Record<string, number> => {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instant));
  return Object.fromEntries(formatted.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
};

export function offsetMinutes(instant: number, timeZone: string): number {
  const { year = 0, month = 1, day = 1, hour = 0, minute = 0, second = 0 } = partsOf(instant, timeZone);
  return Math.round((Date.UTC(year, month - 1, day, hour, minute, second) - Math.floor(instant / 1000) * 1000) / 60_000);
}

export function zonedInstant(date: string, time: string, timeZone: string): Date {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const first = wall - offsetMinutes(wall, timeZone) * 60_000;
  const second = wall - offsetMinutes(first, timeZone) * 60_000;
  return new Date(second);
}

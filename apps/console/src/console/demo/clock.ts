export const DEMO_NOW = '2026-11-13T21:30:00+01:00';

export type Clock = () => Date;

export function createDemoClock(): Clock {
  const origin = Date.parse(DEMO_NOW);
  let started: number | null = null;
  return () => {
    const now = Date.now();
    started ??= now;
    return new Date(origin + (now - started));
  };
}

export function isoAt(day: string, time: string): string {
  return `${day}T${time}:00+01:00`;
}

export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function addMonths(day: string, months: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

export function parisDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(date);
}

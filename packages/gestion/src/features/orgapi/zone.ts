export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function listTimeZones(): string[] {
  const supported = (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
  const zones = new Set(['Europe/Paris', 'Europe/Brussels', 'Europe/Luxembourg', 'America/Toronto', ...supported]);
  return [...zones].sort();
}

const parts = (instant: Date, timeZone: string): Record<string, string> => {
  const formatted = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(instant);
  return Object.fromEntries(formatted.map((part) => [part.type, part.value]));
};

export function todayIn(timeZone: string, now: Date = new Date()): string {
  const { year = '', month = '', day = '' } = parts(now, timeZone);
  return `${year}-${month}-${day}`;
}

export function localDateOf(instantIso: string, timeZone: string): string {
  return todayIn(timeZone, new Date(instantIso));
}

export function localTimeOf(instantIso: string, timeZone: string): string {
  const { hour = '', minute = '' } = parts(new Date(instantIso), timeZone);
  return `${hour}:${minute}`;
}

export function formatDateTimeFr(instantIso: string, timeZone: string): string {
  const day = new Intl.DateTimeFormat('fr-FR', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(instantIso));
  return `${day} à ${localTimeOf(instantIso, timeZone)}`;
}

export function zoneLabel(timeZone: string, instant: Date = new Date()): string {
  const name = new Intl.DateTimeFormat('fr-FR', { timeZone, timeZoneName: 'shortOffset' }).formatToParts(instant).find((part) => part.type === 'timeZoneName')?.value ?? '';
  return `${timeZone.replace('_', ' ')} (${name})`;
}

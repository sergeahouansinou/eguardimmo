const PARIS = "Europe/Paris";

function parse(iso: string): Date {
  const date = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new RangeError(`Date invalide : ${iso}`);
  return date;
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: PARIS }).format(parse(iso));
}

export function formatDayMonth(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", timeZone: PARIS }).format(parse(iso));
}

export function monthLabel(yearMonth: string): string {
  const text = new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" }).format(parse(`${yearMonth}-15`));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function monthYearLabel(yearMonth: string): string {
  return `${monthLabel(yearMonth)} ${yearMonth.slice(0, 4)}`;
}

export function monthName(yearMonth: string): string {
  return monthLabel(yearMonth).toLowerCase();
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parse(toIso).getTime() - parse(fromIso).getTime()) / 86_400_000);
}

export function addMonths(iso: string, months: number): string {
  const date = parse(iso);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString().slice(0, 10);
}

export function wholeMonthsBetween(fromIso: string, toIso: string): number {
  const from = parse(fromIso);
  const to = parse(toIso);
  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  return months;
}

export function formatRemaining(fromIso: string, toIso: string): string {
  const months = wholeMonthsBetween(fromIso, toIso);
  if (months < 0) return "Échéance dépassée";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${String(years)} ${years > 1 ? "ans" : "an"}`);
  if (rest > 0) parts.push(`${String(rest)} mois`);
  if (parts.length === 0) return "Dans moins d'un mois";
  return `Dans ${parts.join(" et ")}`;
}

export function ofMonth(yearMonth: string): string {
  const name = monthName(yearMonth);
  return /^[aeiouhéèêàâîïôöûü]/.test(name) ? `d'${name}` : `de ${name}`;
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${String(count)} ${count > 1 ? pluralForm : singular}`;
}

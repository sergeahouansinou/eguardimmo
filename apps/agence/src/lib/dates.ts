export const DEMO_TODAY = "2026-11-13";

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDay(iso: string): { year: number; month: number; day: number } {
  const match = ISO_DAY.exec(iso);
  if (!match) throw new RangeError(`Date invalide : ${iso}`);
  const [, year, month, day] = match;
  const parts = { year: Number(year), month: Number(month), day: Number(day) };
  const check = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (check.getUTCFullYear() !== parts.year || check.getUTCMonth() !== parts.month - 1 || check.getUTCDate() !== parts.day) {
    throw new RangeError(`Date invalide : ${iso}`);
  }
  return parts;
}

export function formatDay(iso: string): string {
  const { year, month, day } = parseDay(iso);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${String(year)}`;
}

export function formatDayMonth(iso: string): string {
  const { month, day } = parseDay(iso);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}

export function monthName(iso: string): string {
  return MONTHS[parseDay(iso).month - 1] ?? "";
}

export function formatLongDay(iso: string): string {
  const { year, month, day } = parseDay(iso);
  const weekday = new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${String(day)} ${MONTHS[month - 1] ?? ""} ${String(year)}`;
}

export function dayNumber(iso: string): number {
  const { year, month, day } = parseDay(iso);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return dayNumber(toIso) - dayNumber(fromIso);
}

export function addDays(iso: string, days: number): string {
  const { year, month, day } = parseDay(iso);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return toIso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function addMonths(iso: string, months: number): string {
  const { year, month, day } = parseDay(iso);
  const index = year * 12 + (month - 1) + months;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  const lastDay = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
  return toIso(nextYear, nextMonth, Math.min(day, lastDay));
}

export function toIso(year: number, month: number, day: number): string {
  return `${String(year)}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function yearMonth(iso: string): string {
  return iso.slice(0, 7);
}

export function relativeMonths(fromIso: string, toIso: string): string {
  const days = daysBetween(fromIso, toIso);
  if (days < 0) return "Échu";
  const months = Math.round(days / 30.4);
  if (months < 1) return `Dans ${String(days)} j`;
  return `Dans ${String(months)} mois`;
}

export function isoDayOrNull(value: string): string | null {
  try {
    parseDay(value);
    return value;
  } catch {
    return null;
  }
}

export function ofMonth(iso: string): string {
  const name = monthName(iso);
  return /^[aeiouéèh]/.test(name) ? `d'${name}` : `de ${name}`;
}

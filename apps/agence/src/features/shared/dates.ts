export { DEMO_TODAY } from "@/lib/dates";
export const DEMO_NOW = "2026-11-13T10:02:00";

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
] as const;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

function parts(iso: string): { year: number; month: number; day: number } {
  const match = ISO_DATE.exec(iso);
  if (!match) throw new RangeError(`Date ISO invalide : ${iso}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function formatDate(iso: string): string {
  const { year, month, day } = parts(iso);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${String(year)}`;
}

export function formatDateTime(iso: string): string {
  const time = /T(\d{2}:\d{2})/.exec(iso)?.[1];
  return time ? `${formatDate(iso)}, ${time}` : formatDate(iso);
}

export function formatDayMonth(iso: string): string {
  return formatDate(iso).slice(0, 5);
}

export function formatPeriod(period: string): string {
  const [year, month] = period.split("-");
  const name = MONTHS[Number(month) - 1];
  if (!year || !name) throw new RangeError(`Période invalide : ${period}`);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
}

export function periodOf(iso: string): string {
  return iso.slice(0, 7);
}

function toUtc(iso: string): number {
  const { year, month, day } = parts(iso);
  return Date.UTC(year, month - 1, day);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((toUtc(toIso) - toUtc(fromIso)) / 86_400_000);
}

export function addDays(iso: string, days: number): string {
  return new Date(toUtc(iso) + days * 86_400_000).toISOString().slice(0, 10);
}

export function addMonths(iso: string, months: number): string {
  const { year, month, day } = parts(iso);
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = (index % 12) + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  return `${String(targetYear)}-${String(targetMonth).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

export function monthsBetween(fromIso: string, toIso: string): number {
  const from = parts(fromIso);
  const to = parts(toIso);
  const months = (to.year - from.year) * 12 + (to.month - from.month);
  return to.day < from.day ? months - 1 : months;
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const { year, month, day } = parts(value);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

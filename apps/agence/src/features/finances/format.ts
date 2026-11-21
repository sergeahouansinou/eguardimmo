import { ofMonth } from "@/lib/dates";
import { formatDate, formatPeriod } from "@/features/shared/dates";
import { formatRate } from "@/features/shared/money";
import type { FeeBase, PaymentMode, ReminderChannel } from "./inputs";

export function rateText(basisPoints: number): string {
  const percent = basisPoints / 100;
  const text = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(percent);
  return `${text} %`;
}

export function rateTtc(basisPoints: number): string {
  return `${formatRate(basisPoints)} TTC`;
}

export function installmentLabel(period: string): string {
  return `Loyer ${ofMonth(`${period}-01`)}`;
}

export function executionDateOf(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const next = (month ?? 1) === 12 ? { y: (year ?? 0) + 1, m: 1 } : { y: year ?? 0, m: (month ?? 1) + 1 };
  return `${String(next.y)}-${String(next.m).padStart(2, "0")}-05`;
}

export function periodOptions(periods: readonly string[]): { value: string; label: string }[] {
  return periods.map((value) => ({ value, label: formatPeriod(value) }));
}

export const MODE_LABELS: Record<PaymentMode, string> = {
  virement: "Virement",
  cheque: "Chèque",
  prelevement: "Prélèvement",
  especes: "Espèces",
};

export const CHANNEL_LABELS: Record<ReminderChannel, string> = {
  email: "E-mail",
  sms: "SMS",
  courrier: "Courrier",
};

export const BASE_LABELS: Record<FeeBase, string> = {
  rent: "Loyer hors charges",
  rent_and_charges: "Loyer et charges",
};

export function joinLabels(labels: readonly string[]): string {
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} et ${labels.at(-1) ?? ""}`;
}

export function dateOrDash(iso: string | null): string {
  return iso ? formatDate(iso) : "—";
}

export function csvAmount(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  return `${sign}${String(Math.floor(abs / 100))},${String(abs % 100).padStart(2, "0")}`;
}

export function monthOfPeriod(period: string): string {
  return formatPeriod(period).split(" ")[0]?.toLowerCase() ?? "";
}

export function percentOf(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

export function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count > 1 ? many : one}`;
}

export const FEE_PERIODS = [
  { value: "2026-11", label: "Novembre 2026" },
  { value: "2026-10", label: "Octobre 2026" },
  { value: "2026", label: "Année 2026" },
] as const;

export function basisPointsText(basisPoints: number): string {
  return `${String(Math.floor(basisPoints / 100))},${String(basisPoints % 100).padStart(2, "0")}`;
}

import { formatCurrency } from "./currency";
import type { Currency } from "./currency";

export function formatEuros(minor: number, currency: Currency = "EUR"): string {
  return formatCurrency(minor, currency);
}

export function formatEurosExact(minor: number, currency: Currency = "EUR"): string {
  return formatCurrency(minor, currency, { fixed: true });
}

export function formatEurosSigned(minor: number, currency: Currency = "EUR"): string {
  return formatCurrency(minor, currency, { fixed: true, signed: true });
}

export function applyRate(baseMinor: number, rateBasisPoints: number): number {
  return Math.round((baseMinor * rateBasisPoints) / 10_000);
}

export function formatRate(rateBasisPoints: number): string {
  const percent = rateBasisPoints / 100;
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(percent)} %`;
}

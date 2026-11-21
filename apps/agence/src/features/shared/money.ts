import { formatCurrency, parseAmount } from "@/lib/currency";
import type { Currency } from "@/lib/currency";

export type { Currency };

export function formatMoney(minor: number, currency: Currency = "EUR", options: { signed?: boolean } = {}): string {
  return formatCurrency(minor, currency, { signed: options.signed === true });
}

export function formatMoneyExact(minor: number, currency: Currency = "EUR"): string {
  return formatCurrency(minor, currency, { fixed: true });
}

const CURRENCY_SYMBOLS = /[€]|F\s?CFA/gi;

export function parseMoney(text: string, currency: Currency = "EUR"): number | null {
  return parseAmount(text.replace(CURRENCY_SYMBOLS, ""), currency);
}

export function applyRate(amountMinor: number, rateBasisPoints: number): number {
  return Math.round((amountMinor * rateBasisPoints) / 10_000);
}

export function splitVat(ttcMinor: number, vatBasisPoints: number): { ht: number; vat: number } {
  const ht = Math.round((ttcMinor * 10_000) / (10_000 + vatBasisPoints));
  return { ht, vat: ttcMinor - ht };
}

export function formatRate(rateBasisPoints: number): string {
  return `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rateBasisPoints / 100)}\u00a0%`;
}

export function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

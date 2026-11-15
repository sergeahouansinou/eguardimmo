import { splitVat } from "@/features/shared/money";

export function isValidSiren(raw: string): boolean {
  const digits = raw.replace(/\s/g, "");
  if (!/^\d{9}$/.test(digits)) return false;
  const sum = Array.from(digits)
    .reverse()
    .reduce((total, char, index) => {
      const digit = Number(char);
      const value = index % 2 === 1 ? digit * 2 : digit;
      return total + (value > 9 ? value - 9 : value);
    }, 0);
  return sum % 10 === 0;
}

export function formatSiren(raw: string): string {
  const digits = raw.replace(/\s/g, "");
  return digits.replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3");
}

export function normalizeIban(raw: string): string {
  return raw.replace(/\s/g, "").toUpperCase();
}

export function isValidFrenchIban(raw: string): boolean {
  const iban = normalizeIban(raw);
  if (!/^FR\d{2}[0-9A-Z]{23}$/.test(iban)) return false;
  const numeric = Array.from(`${iban.slice(4)}${iban.slice(0, 4)}`)
    .map((char) => String(Number.parseInt(char, 36)))
    .join("");
  let remainder = 0;
  for (const char of numeric) remainder = (remainder * 10 + Number(char)) % 97;
  return remainder === 1;
}

export function maskIban(raw: string): { masked: string; last4: string } {
  const iban = normalizeIban(raw);
  const last4 = iban.slice(-4);
  return { masked: `${iban.slice(0, 4)} •••• •••• •••• •••• ${last4}`, last4 };
}

const RATE_TEXT = /^\d{1,2}(?:[.,]\d{1,2})?$/;

export function parseRateBp(text: string): number | null {
  const compact = text.replace(/[\s %]/g, "");
  if (!RATE_TEXT.test(compact)) return null;
  return Math.round(Number(compact.replace(",", ".")) * 100);
}

export function formatPercent(basisPoints: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(basisPoints / 100)} %`;
}

export function rateBpToText(basisPoints: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2, useGrouping: false }).format(basisPoints / 100);
}

export function excludingVatRate(ttcBasisPoints: number, vatBasisPoints: number): number {
  return splitVat(ttcBasisPoints, vatBasisPoints).ht;
}

export function payoutDayLabel(day: number): string {
  return day === 1 ? "Le 1er du mois" : `Le ${String(day)} du mois`;
}

import { parseRateBasisPoints } from "@/lib/currency";

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

const IBAN_SHAPE = /^[A-Z]{2}\d{2}[0-9A-Z]{11,30}$/;

export function isValidIban(raw: string): boolean {
  const iban = normalizeIban(raw);
  if (!IBAN_SHAPE.test(iban)) return false;
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

const MAX_RATE_BASIS_POINTS = 10_000;

export function parseRateBp(text: string): number | null {
  const basisPoints = parseRateBasisPoints(text);
  return basisPoints !== null && basisPoints < MAX_RATE_BASIS_POINTS ? basisPoints : null;
}

export function formatPercent(basisPoints: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(basisPoints / 100)} %`;
}

export function rateBpToText(basisPoints: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2, useGrouping: false }).format(basisPoints / 100);
}

export function payoutDayLabel(day: number): string {
  return day === 1 ? "Le 1er du mois" : `Le ${String(day)} du mois`;
}

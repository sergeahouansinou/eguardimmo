export type Currency = "EUR" | "XOF";

const MINOR_DIGITS: Record<Currency, number> = { EUR: 2, XOF: 0 };

export function formatMoney(minor: number, currency: Currency = "EUR", options: { signed?: boolean } = {}): string {
  if (!Number.isSafeInteger(minor)) throw new RangeError(`Montant en unités mineures non entier : ${String(minor)}`);
  const digits = MINOR_DIGITS[currency];
  const factor = 10 ** digits;
  const whole = minor % factor === 0;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: whole ? 0 : digits,
    maximumFractionDigits: whole ? 0 : digits,
    signDisplay: options.signed ? "exceptZero" : "auto",
  })
    .format(minor / factor)
    .replace(/[\u202f\u00a0]/g, "\u00a0");
}

export function formatMoneyExact(minor: number): string {
  if (!Number.isSafeInteger(minor)) throw new RangeError(`Montant en unités mineures non entier : ${String(minor)}`);
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(minor / 100)
    .replace(/[\u202f\u00a0]/g, "\u00a0");
}

const MONEY_TEXT = /^\d{1,9}(?:[.,]\d{1,2})?$/;

export function parseMoney(text: string): number | null {
  const compact = text.replace(/[\s\u00a0\u202f€]/g, "");
  if (!MONEY_TEXT.test(compact)) return null;
  const [whole = "0", decimals = ""] = compact.replace(",", ".").split(".");
  return Number(whole) * 100 + Number(decimals.padEnd(2, "0"));
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

export const CURRENCIES = ["EUR", "XOF"] as const;
export type Currency = (typeof CURRENCIES)[number];

const MINOR_DIGITS: Readonly<Record<Currency, number>> = { EUR: 2, XOF: 0 };
const SPACES = /[\s  ]/g;
const MAX_WHOLE_DIGITS = 9;
const MAX_RATE_WHOLE_DIGITS = 3;
const RATE_DIGITS = 2;

const CURRENCY_NAMES: Readonly<Record<Currency, string>> = { EUR: "euros", XOF: "francs CFA" };
const CURRENCY_SYMBOLS: Readonly<Record<Currency, string>> = { EUR: "€", XOF: "F CFA" };
const AMOUNT_EXAMPLES: Readonly<Record<Currency, string>> = { EUR: "500", XOF: "250 000" };

export const currencyName = (currency: Currency): string => CURRENCY_NAMES[currency];
export const currencySymbol = (currency: Currency): string => CURRENCY_SYMBOLS[currency];
export const amountExample = (currency: Currency): string => AMOUNT_EXAMPLES[currency];

export const currencyDigits = (currency: Currency): number => MINOR_DIGITS[currency];

export const currencyOf = (code: string): Currency | undefined => CURRENCIES.find((currency) => currency === code);

const DIGITS = /^[0-9]+$/;

const onlyDigits = (text: string): boolean => DIGITS.test(text);

function parseDecimalParts(text: string, fractionDigits: number, maxWholeDigits: number): { whole: string; fraction: string } | null {
  const parts = text.replace(",", ".").split(".");
  if (parts.length > 2) return null;
  const [whole = "", fraction = ""] = parts;
  if (!onlyDigits(whole) || whole.length > maxWholeDigits) return null;
  if (parts.length === 2 && (!onlyDigits(fraction) || fraction.length > fractionDigits)) return null;
  return { whole, fraction: fraction.padEnd(fractionDigits, "0") };
}

export function parseAmount(text: string, currency: Currency): number | null {
  const parts = parseDecimalParts(text.replace(SPACES, ""), currencyDigits(currency), MAX_WHOLE_DIGITS);
  return parts === null ? null : Number(`${parts.whole}${parts.fraction}`);
}

export function parseRateBasisPoints(text: string): number | null {
  const parts = parseDecimalParts(text.replace(SPACES, "").replace("%", ""), RATE_DIGITS, MAX_RATE_WHOLE_DIGITS);
  return parts === null ? null : Number(`${parts.whole}${parts.fraction}`);
}

function formatDecimalInput(minor: number, digits: number): string {
  if (!Number.isSafeInteger(minor)) throw new RangeError(`Montant en unités mineures non entier : ${String(minor)}`);
  const factor = 10 ** digits;
  const whole = Math.trunc(minor / factor);
  const fraction = Math.abs(minor % factor);
  return fraction === 0 ? String(whole) : `${String(whole)},${String(fraction).padStart(digits, "0")}`;
}

export const formatAmountInput = (minor: number, currency: Currency): string => formatDecimalInput(minor, currencyDigits(currency));

export const formatRateInput = (basisPoints: number): string => formatDecimalInput(basisPoints, RATE_DIGITS);

export function formatCurrency(minor: number, currency: Currency, options: { fixed?: boolean; signed?: boolean } = {}): string {
  if (!Number.isSafeInteger(minor)) throw new RangeError(`Montant en unités mineures non entier : ${String(minor)}`);
  const digits = currencyDigits(currency);
  const factor = 10 ** digits;
  const fraction = options.fixed === true || minor % factor !== 0 ? digits : 0;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
    signDisplay: options.signed === true ? "exceptZero" : "auto",
  })
    .format(minor / factor)
    .replace(/[  ]/g, " ");
}

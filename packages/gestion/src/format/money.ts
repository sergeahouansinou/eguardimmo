export const CURRENCIES = ['EUR', 'XOF', 'CAD'] as const;
export type Currency = (typeof CURRENCIES)[number];

const MINOR_DIGITS: Record<Currency, number> = { EUR: 2, XOF: 0, CAD: 2 };

export const isCurrency = (code: string): code is Currency => CURRENCIES.some((currency) => currency === code);

export function minorDigits(currency: Currency): number {
  return MINOR_DIGITS[currency];
}

const SPACES = /[\s\u00a0\u202f]/g;
const MAX_WHOLE_DIGITS = 9;

const DIGITS = /^[0-9]+$/;

const onlyDigits = (text: string): boolean => DIGITS.test(text);

export function parseAmount(text: string, currency: Currency): number | null {
  const digits = MINOR_DIGITS[currency];
  const parts = text.replace(SPACES, '').replace(',', '.').split('.');
  if (parts.length > 2) return null;
  const [whole = '', fraction = ''] = parts;
  if (!onlyDigits(whole) || whole.length > MAX_WHOLE_DIGITS) return null;
  if (parts.length === 2 && (!onlyDigits(fraction) || fraction.length > digits)) return null;
  return Number(`${whole}${fraction.padEnd(digits, '0')}`);
}

export function formatAmountInput(minor: number, currency: Currency): string {
  if (!Number.isSafeInteger(minor)) throw new RangeError(`Montant en unités mineures non entier : ${String(minor)}`);
  const digits = MINOR_DIGITS[currency];
  const factor = 10 ** digits;
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const whole = Math.trunc(abs / factor);
  const fraction = abs % factor;
  return fraction === 0 ? `${sign}${String(whole)}` : `${sign}${String(whole)},${String(fraction).padStart(digits, '0')}`;
}

export interface MoneyFormatOptions {
  signed?: boolean;
}

export function formatMoney(minor: number, currency: Currency, options: MoneyFormatOptions = {}): string {
  if (!Number.isSafeInteger(minor)) throw new RangeError(`Montant en unités mineures non entier : ${String(minor)}`);
  const digits = MINOR_DIGITS[currency];
  const factor = 10 ** digits;
  const whole = minor % factor === 0;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: whole ? 0 : digits,
    maximumFractionDigits: whole ? 0 : digits,
    signDisplay: options.signed ? 'exceptZero' : 'auto',
  })
    .format(minor / factor)
    .replace(/ /g, ' ');
}

export function formatCompactMajor(minor: number, currency: Currency): string {
  const major = minor / 10 ** MINOR_DIGITS[currency];
  if (major === 0) return '0';
  if (Math.abs(major) >= 1_000_000) return `${formatNumber(major / 1_000_000)}\u00a0M`;
  if (Math.abs(major) >= 1_000) return `${formatNumber(major / 1_000)}\u00a0k`;
  return formatNumber(major);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value).replace(/ /g, ' ');
}

export function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

export function variation(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

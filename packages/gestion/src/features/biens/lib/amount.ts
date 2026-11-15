import { minorDigits } from '../../../format/money';
import type { Currency } from '../../../format/money';

const AMOUNT = /^\d+(?:[.,]\d+)?$/;

export function parseAmountToMinor(text: string, currency: Currency): number | null {
  const compact = text.replace(/[\s  ]/g, '');
  if (!AMOUNT.test(compact)) return null;
  const [whole = '0', fraction = ''] = compact.split(/[.,]/);
  const digits = minorDigits(currency);
  if (fraction.length > digits) return null;
  const minor = Number(`${whole}${fraction.padEnd(digits, '0')}`);
  return Number.isSafeInteger(minor) ? minor : null;
}

export function parseDecimal(text: string): number | null {
  const compact = text.replace(/[\s  ]/g, '');
  if (!AMOUNT.test(compact)) return null;
  const value = Number(compact.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

export function formatNumber(value: number, maxDigits = 1): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: maxDigits })
    .format(value)
    .replace(/[  ]/g, ' ');
}

export function formatArea(value: number): string {
  return `${formatNumber(value)} m²`;
}

export function toMajorInput(minor: number, currency: Currency): string {
  const digits = minorDigits(currency);
  if (digits === 0) return String(minor);
  const factor = 10 ** digits;
  const whole = Math.trunc(minor / factor);
  const fraction = Math.abs(minor % factor);
  return fraction === 0 ? String(whole) : `${String(whole)},${String(fraction).padStart(digits, '0')}`;
}

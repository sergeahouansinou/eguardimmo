import { minorDigits } from '../../../format/money';
import type { Currency } from '../../../format/money';

const MAX_MINOR = 100_000_000_000_000;

const isDigits = (text: string): boolean => text.length > 0 && Array.from(text).every((char) => char >= '0' && char <= '9');
const stripSpaces = (text: string): string => Array.from(text).filter((char) => char.trim() !== '').join('');

export function parseMinor(text: string, currency: Currency, options: { signed?: boolean } = {}): number | null {
  let value = stripSpaces(text).replace(',', '.');
  let negative = false;
  if (options.signed === true && value.startsWith('-')) {
    negative = true;
    value = value.slice(1);
  }
  const parts = value.split('.');
  const digits = minorDigits(currency);
  const [whole = '', decimals = ''] = parts;
  if (parts.length > 2 || !isDigits(whole) || (decimals !== '' && !isDigits(decimals)) || decimals.length > digits || (parts.length === 2 && decimals === '')) return null;
  const minor = Number(whole) * 10 ** digits + Number(decimals.padEnd(digits, '0') || '0');
  if (!Number.isSafeInteger(minor) || minor > MAX_MINOR) return null;
  return negative ? -minor : minor;
}

export function minorToInput(minor: number, currency: Currency): string {
  const digits = minorDigits(currency);
  const sign = minor < 0 ? '-' : '';
  const absolute = Math.abs(minor);
  if (digits === 0) return `${sign}${String(absolute)}`;
  const factor = 10 ** digits;
  return `${sign}${String(Math.trunc(absolute / factor))},${String(absolute % factor).padStart(digits, '0')}`;
}

export const amountHint = (currency: Currency): string => (minorDigits(currency) === 0 ? 'nombre entier de francs, ex. 450000' : 'montant en euros, ex. 850,50');

export const isWholeNumber = isDigits;

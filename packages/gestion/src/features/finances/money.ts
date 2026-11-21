import { formatAmountInput, minorDigits, parseAmount } from '../../format/money';
import type { Currency } from '../../format/money';

export function parseMoneyInput(text: string, currency: Currency = 'EUR'): number | null {
  return parseAmount(text, currency);
}

export function formatMoneyInput(minor: number, currency: Currency = 'EUR'): string {
  return formatAmountInput(minor, currency);
}

export function divRound(numerator: number, denominator: number): number {
  return Math.trunc((numerator * 2 + denominator) / (denominator * 2));
}

export function percentOf(minor: number, pct: number): number {
  return divRound(minor * pct, 100);
}

export function splitEvenly(total: number, count: number): number[] {
  const base = Math.trunc(total / count);
  const parts = Array.from({ length: count }, () => base);
  parts[count - 1] = total - base * (count - 1);
  return parts;
}

export function sum(values: readonly number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}

export function formatDecimal(minor: number, currency: Currency = 'EUR'): string {
  const digits = minorDigits(currency);
  const factor = 10 ** digits;
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const whole = new Intl.NumberFormat('fr-FR').format(Math.trunc(abs / factor)).replace(/[  ]/g, ' ');
  return digits === 0 ? `${sign}${whole}` : `${sign}${whole},${String(abs % factor).padStart(digits, '0')}`;
}

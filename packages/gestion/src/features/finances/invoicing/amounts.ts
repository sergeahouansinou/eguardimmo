import { parseMinorUnits } from '../rent/api/rentPayloads';
import { minorDigits } from '../../../format/money';
import type { Currency } from '../../../format/money';
import type { DraftLineInput } from './model';

export { amountHint, parseMinorUnits } from '../rent/api/rentPayloads';

const MAX_QUANTITY_MILLI = 1_000_000_000;
const MAX_UNIT_PRICE = 10_000_000_000;

export function parseQuantityMilli(text: string): number | null {
  const value = text.trim();
  if (!/^\d+([.,]\d{1,3})?$/.test(value)) return null;
  const [whole = '0', decimals = ''] = value.replace(',', '.').split('.');
  const milli = Number(whole) * 1000 + Number(decimals.padEnd(3, '0'));
  return Number.isSafeInteger(milli) && milli >= 1 && milli <= MAX_QUANTITY_MILLI ? milli : null;
}

export function parseUnitPrice(text: string, currency: Currency): number | null {
  const minor = parseMinorUnits(text, currency);
  return minor !== null && minor <= MAX_UNIT_PRICE ? minor : null;
}

export function lineNet(quantityMilli: number, unitPrice: number): number {
  return Number((BigInt(quantityMilli) * BigInt(unitPrice) + 500n) / 1000n);
}

export function previewNet(lines: readonly DraftLineInput[], currency: Currency): number | null {
  let total = 0;
  for (const line of lines) {
    const quantity = parseQuantityMilli(line.quantity);
    const price = parseUnitPrice(line.unitPrice, currency);
    if (quantity === null || price === null) return null;
    total += lineNet(quantity, price);
  }
  return Number.isSafeInteger(total) ? total : null;
}

export function formatQuantity(milli: number): string {
  const whole = Math.trunc(milli / 1000);
  const fraction = String(milli % 1000).padStart(3, '0').replace(/0+$/, '');
  return fraction === '' ? String(whole) : `${String(whole)},${fraction}`;
}

export function formatRate(ratePcm: number): string {
  const whole = Math.trunc(ratePcm / 1000);
  const fraction = String(ratePcm % 1000).padStart(3, '0').replace(/0+$/, '');
  return `${fraction === '' ? String(whole) : `${String(whole)},${fraction}`} %`;
}

export function minorToInput(minor: number, currency: Currency): string {
  const digits = minorDigits(currency);
  if (digits === 0) return String(minor);
  const factor = 10 ** digits;
  return `${String(Math.trunc(minor / factor))},${String(minor % factor).padStart(digits, '0')}`;
}

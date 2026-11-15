import { formatMoney } from '../../../format/money';

export const money = (minor: number): string => formatMoney(minor, 'EUR');

export const moneyPlain = (minor: number): string =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100).replace(/\u202f/g, '\u00a0');

export const euros = (value: number): number => Math.round(value * 100);

export function parseEuros(input: string): number {
  const [whole = '0', decimals = ''] = input.trim().replace(',', '.').split('.');
  return Number(whole) * 100 + Number(decimals.padEnd(2, '0').slice(0, 2));
}

export function euroInput(minor: number): string {
  const whole = Math.trunc(minor / 100);
  const cents = Math.abs(minor % 100);
  return cents === 0 ? String(whole) : `${String(whole)},${String(cents).padStart(2, '0')}`;
}

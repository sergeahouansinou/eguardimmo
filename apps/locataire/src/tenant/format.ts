import type { Money } from './model';

export const NOT_AVAILABLE = 'Non disponible';

const SPACES = /[  ]/g;

export function formatApiMoney({ amount, currency }: Money): string {
  const reference = new Intl.NumberFormat('fr-FR', { style: 'currency', currency });
  const digits = reference.resolvedOptions().maximumFractionDigits ?? 2;
  const scale = 10 ** digits;
  const whole = amount % scale === 0;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: whole ? 0 : digits,
    maximumFractionDigits: digits,
  })
    .format(amount / scale)
    .replace(SPACES, ' ');
}

export function formatSurface(hundredths: number | null): string {
  if (hundredths === null) return NOT_AVAILABLE;
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(hundredths / 100).replace(SPACES, ' ')} m²`;
}

export function formatFloor(floor: number | null): string {
  if (floor === null) return NOT_AVAILABLE;
  if (floor === 0) return 'Rez-de-chaussée';
  return floor < 0 ? `Sous-sol ${String(Math.abs(floor))}` : floor === 1 ? '1er étage' : `${String(floor)}e étage`;
}

export function formatBasisPoints(basisPoints: number): string {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(basisPoints / 100).replace(SPACES, ' ')} %`;
}

export function sumMoney(amounts: readonly Money[]): Money | null {
  const first = amounts[0];
  if (first === undefined) return null;
  if (amounts.some((money) => money.currency !== first.currency)) return null;
  return { amount: amounts.reduce((total, money) => total + money.amount, 0), currency: first.currency };
}

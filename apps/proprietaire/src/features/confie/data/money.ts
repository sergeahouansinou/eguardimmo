const format = (minor: number, fixed: boolean): string => {
  if (!Number.isSafeInteger(minor)) throw new RangeError(`Montant en unités mineures non entier : ${String(minor)}`);
  const whole = minor % 100 === 0 && !fixed;
  const digits = whole ? 0 : 2;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
    .format(minor / 100)
    .replace(/[  ]/g, " ");
};

export const eur = (minor: number): string => format(minor, false);
export const eurFixed = (minor: number): string => format(minor, true);
export const eurSigned = (minor: number): string => `− ${eurFixed(Math.abs(minor))}`;

export function percentOf(part: number, total: number): number {
  return total <= 0 ? 0 : Math.round((part / total) * 100);
}

export function feeOf(amount: number, ratePercent: number): number {
  return Math.round((amount * ratePercent) / 100);
}

export function vatIncluded(totalTtc: number, ratePercent: number): number {
  return Math.round((totalTtc * ratePercent) / (100 + ratePercent));
}

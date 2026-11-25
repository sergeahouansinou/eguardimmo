export function minorDigits(currency: string): number {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

export function formatMinor(minor: number, currency: string): string {
  if (!Number.isSafeInteger(minor)) throw new RangeError(`Montant non entier : ${String(minor)}`);
  const digits = minorDigits(currency);
  const major = minor / 10 ** digits;
  const whole = Number.isInteger(major);
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: whole ? 0 : digits,
    maximumFractionDigits: digits,
  })
    .format(major)
    .replace(/[  ]/g, " ");
}

export function majorToMinor(major: number, currency: string): number {
  return Math.round(major * 10 ** minorDigits(currency));
}

export function minorToPlainNumber(minor: number, currency: string): string {
  return String(minor / 10 ** minorDigits(currency));
}

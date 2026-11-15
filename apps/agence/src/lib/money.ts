const NBSP = /[  ]/g;

function format(minor: number, fixed: boolean, signed: boolean): string {
  if (!Number.isSafeInteger(minor)) throw new RangeError(`Montant en centimes non entier : ${String(minor)}`);
  const whole = minor % 100 === 0;
  const digits = fixed || !whole ? 2 : 0;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: signed ? "exceptZero" : "auto",
  })
    .format(minor / 100)
    .replace(NBSP, " ");
}

export function formatEuros(minor: number): string {
  return format(minor, false, false);
}

export function formatEurosExact(minor: number): string {
  return format(minor, true, false);
}

export function formatEurosSigned(minor: number): string {
  return format(minor, true, true);
}

export function applyRate(baseMinor: number, rateBasisPoints: number): number {
  return Math.round((baseMinor * rateBasisPoints) / 10_000);
}

export function formatRate(rateBasisPoints: number): string {
  const percent = rateBasisPoints / 100;
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(percent)} %`;
}

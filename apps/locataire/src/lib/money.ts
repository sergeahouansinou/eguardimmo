export interface MoneyOptions {
  fixed?: boolean;
}

export function formatMoney(cents: number, options: MoneyOptions = {}): string {
  if (!Number.isSafeInteger(cents)) throw new RangeError(`Montant en centimes non entier : ${String(cents)}`);
  const whole = cents % 100 === 0 && !options.fixed;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  })
    .format(cents / 100)
    .replace(/[  ]/g, ' ');
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1).replace('.', ',')} Mo`;
  return `${String(Math.max(1, Math.round(bytes / 1000)))} Ko`;
}

export function formatAmount(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new RangeError(`Montant en centimes non entier : ${String(cents)}`);
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(cents / 100)
    .replace(/[  ]/g, ' ');
}

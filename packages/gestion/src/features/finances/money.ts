export function parseMoneyInput(text: string): number | null {
  const cleaned = text.replace(/[\s  ]/g, '').replace(',', '.');
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const whole = Number(match[1]);
  const cents = Number((match[2] ?? '').padEnd(2, '0'));
  return whole * 100 + cents;
}

export function formatMoneyInput(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const whole = Math.trunc(abs / 100);
  const cents = abs % 100;
  return cents === 0 ? `${sign}${String(whole)}` : `${sign}${String(whole)},${String(cents).padStart(2, '0')}`;
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

export function formatDecimal(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const whole = new Intl.NumberFormat('fr-FR').format(Math.trunc(abs / 100)).replace(/[  ]/g, ' ');
  return `${sign}${whole},${String(abs % 100).padStart(2, '0')}`;
}

import { formatInteger, parseEurosToMinor } from '@/lib/format';
import { limitInputSchema } from './schemas';

const SYMBOLS: Record<string, string> = { EUR: '€', CAD: 'CA$' };

export function formatMinor(minor: number, currency: string): string {
  const whole = Math.trunc(minor / 100);
  const cents = minor % 100;
  const text = `${formatInteger(whole)}${cents === 0 ? '' : `,${String(cents).padStart(2, '0')}`}`;
  return `${text} ${SYMBOLS[currency] ?? currency}`;
}

export const parseMajor = (text: string): number | null => parseEurosToMinor(text.replaceAll('CA$', ''));

export function parseLimit(text: string): number | null | undefined {
  if (text.trim() === '') return null;
  const parsed = limitInputSchema.safeParse(text);
  return parsed.success ? Number(parsed.data) : undefined;
}

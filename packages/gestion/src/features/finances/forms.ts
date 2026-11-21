import { z } from 'zod';
import type { ZodError } from 'zod';
import type { Currency } from '../../format/money';
import { parseMoneyInput } from './money';

export const moneyText = (label: string, options: { allowZero?: boolean; currency?: Currency } = {}) =>
  z
    .string()
    .trim()
    .min(1, `${label} : saisissez un montant.`)
    .transform((text, ctx) => {
      const value = parseMoneyInput(text, options.currency);
      if (value === null || (!options.allowZero && value === 0)) {
        ctx.addIssue({ code: 'custom', message: `${label} : montant invalide (ex. ${options.currency === 'XOF' ? '250 000' : '850 ou 850,50'}).` });
        return z.NEVER;
      }
      return value;
    });

export const dateText = (label: string) => z.iso.date(`${label} : date invalide.`);

export function fieldErrors(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const name = String(issue.path[0] ?? '_');
    errors[name] ??= issue.message;
  }
  return errors;
}

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function checkAttachment(file: { name: string; size: number }): string | null {
  if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) return 'Format non pris en charge : PDF ou image uniquement.';
  if (file.size > MAX_FILE_BYTES) return 'Fichier trop volumineux : 10 Mo au maximum.';
  return null;
}

import { z } from 'zod';
import type { Period } from './model';

export const MAX_MONTHS = 36;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

const index = (month: string): number => Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
const fromIndex = (value: number): string => `${String(Math.floor(value / 12)).padStart(4, '0')}-${String((value % 12) + 1).padStart(2, '0')}`;

export const monthOf = (isoDate: string): string => isoDate.slice(0, 7);
export const monthsBetween = (from: string, to: string): number => index(to) - index(from) + 1;
export const shiftMonth = (month: string, delta: number): string => fromIndex(index(month) + delta);

export function lastDayOf(month: string): string {
  const day = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  return `${month}-${String(day).padStart(2, '0')}`;
}

export const periodOf = (fromMonth: string, toMonth: string): Period => ({ from: `${fromMonth}-01`, to: lastDayOf(toMonth) });

export const defaultMonths = (today: string): { fromMonth: string; toMonth: string } => ({ fromMonth: shiftMonth(monthOf(today), -11), toMonth: monthOf(today) });

export const periodFormSchema = z
  .object({
    fromMonth: z.string().refine((value) => MONTH.test(value), 'Choisissez un mois de début (AAAA-MM).'),
    toMonth: z.string().refine((value) => MONTH.test(value), 'Choisissez un mois de fin (AAAA-MM).'),
  })
  .superRefine((values, context) => {
    if (!MONTH.test(values.fromMonth) || !MONTH.test(values.toMonth)) return;
    if (monthsBetween(values.fromMonth, values.toMonth) < 1) context.addIssue({ code: 'custom', path: ['toMonth'], message: 'Le mois de fin doit suivre le mois de début.' });
    else if (monthsBetween(values.fromMonth, values.toMonth) > MAX_MONTHS) context.addIssue({ code: 'custom', path: ['toMonth'], message: `La période ne peut pas dépasser ${String(MAX_MONTHS)} mois.` });
  });
export type PeriodFormValues = z.input<typeof periodFormSchema>;

export function monthLabel(month: string, style: 'short' | 'long' = 'long'): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', month: style, year: style === 'long' ? 'numeric' : '2-digit' }).format(new Date(`${month}-01T00:00:00Z`));
}

export const percentOfBp = (bp: number): string => `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(bp / 100)} %`;

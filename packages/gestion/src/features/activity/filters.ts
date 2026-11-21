import { z } from 'zod';
import { addDays, daysBetween } from '../locataires/kit/dates';
import { ACTIVITY_TYPES, MAX_RANGE_DAYS } from './model';
import type { ActivityFilters } from './model';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MIN_DATE = '2000-01-01';

export const RANGE_TOO_WIDE = 'La période ne peut pas dépasser 366 jours.';
export const RANGE_ORDER = 'La date de fin doit être postérieure ou égale à celle de début.';
export const SUBJECT_PAIR = 'Choisissez le type d’élément et saisissez son identifiant, ou videz les deux champs.';

export function isCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function rangeIssue(from: string | null, toExclusive: string | null): string | null {
  if (from !== null && (!isCalendarDate(from) || from < MIN_DATE)) return 'Saisissez une date de début valide, à partir de 2000.';
  if (toExclusive !== null && !isCalendarDate(toExclusive)) return 'Saisissez une date de fin valide.';
  if (from === null || toExclusive === null) return null;
  if (toExclusive <= from) return RANGE_ORDER;
  return daysBetween(from, toExclusive) > MAX_RANGE_DAYS ? RANGE_TOO_WIDE : null;
}

export function subjectIssue(subjectType: string | null, subjectId: string | null): string | null {
  return (subjectType === null) === (subjectId === null) ? null : SUBJECT_PAIR;
}

export const filterFormSchema = z
  .object({ from: z.string(), to: z.string(), actor: z.string(), type: z.string(), subjectType: z.string(), subjectId: z.string() })
  .transform((values, context): ActivityFilters => {
    const text = (value: string): string | null => (value.trim() === '' ? null : value.trim());
    const from = text(values.from);
    const to = text(values.to);
    const subjectType = text(values.subjectType);
    const subjectId = text(values.subjectId);
    const exclusive = to !== null && isCalendarDate(to) ? addDays(to, 1) : to;
    if (from !== null && !isCalendarDate(from)) context.addIssue({ code: 'custom', path: ['from'], message: rangeIssue(from, null) ?? 'Date invalide.' });
    if (to !== null && !isCalendarDate(to)) context.addIssue({ code: 'custom', path: ['to'], message: 'Saisissez une date de fin valide.' });
    const range = from !== null && isCalendarDate(from) && exclusive !== null && isCalendarDate(exclusive) ? rangeIssue(from, exclusive) : null;
    if (range !== null) context.addIssue({ code: 'custom', path: ['to'], message: range });
    const pair = subjectIssue(subjectType, subjectId);
    if (pair !== null) context.addIssue({ code: 'custom', path: [subjectType === null ? 'subjectType' : 'subjectId'], message: pair });
    if (subjectId !== null && !z.guid().safeParse(subjectId).success) context.addIssue({ code: 'custom', path: ['subjectId'], message: 'Cet identifiant n’a pas le bon format.' });
    return {
      from,
      to: exclusive,
      actorId: text(values.actor),
      type: ACTIVITY_TYPES.find((candidate) => candidate === values.type) ?? null,
      subjectType,
      subjectId,
    };
  });

export type FilterFormValues = z.input<typeof filterFormSchema>;

export function toFormValues(filters: ActivityFilters): FilterFormValues {
  const lastDay = filters.to !== null && isCalendarDate(filters.to) ? addDays(filters.to, -1) : (filters.to ?? '');
  return { from: filters.from ?? '', to: lastDay, actor: filters.actorId ?? '', type: filters.type ?? '', subjectType: filters.subjectType ?? '', subjectId: filters.subjectId ?? '' };
}

import { z } from 'zod';
import { EVENT_KINDS, MAX_ATTENDEES, RECURRENCES } from '../model';
import type { EventInput, PlanningEvent } from '../model';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MIN_DATE = '2000-01-01';
const MAX_DATE = '2100-01-01';
const FORBIDDEN_MARKUP = /[<>]/;

const validDate = (value: string): boolean => DATE_PATTERN.test(value) && value > MIN_DATE && value < MAX_DATE && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));

const attendee = z.object({ userId: z.string().nullable(), partyId: z.string().nullable() });

export const eventFormSchema = z
  .object({
    kind: z.enum(EVENT_KINDS, 'Choisissez le type d’événement.'),
    title: z.string().trim().min(1, 'Indiquez un titre.').max(120, 'Le titre ne peut pas dépasser 120 caractères.').refine((value) => !FORBIDDEN_MARKUP.test(value), 'Le titre ne peut pas contenir « < » ni « > ».'),
    notes: z.string().max(1000, 'Les notes ne peuvent pas dépasser 1 000 caractères.').refine((value) => !FORBIDDEN_MARKUP.test(value), 'Les notes ne peuvent pas contenir « < » ni « > ».'),
    startsOn: z.string().refine(validDate, 'Indiquez une date valide.'),
    allDay: z.boolean(),
    startTime: z.string(),
    recurrence: z.enum(RECURRENCES),
    recurrenceUntil: z.string(),
    reminder: z.enum(['', '60', '1440']),
    propertyId: z.string(),
    unitId: z.string(),
    leaseId: z.string(),
    attendees: z.array(attendee).max(MAX_ATTENDEES, `Un événement compte ${String(MAX_ATTENDEES)} participants au plus.`),
  })
  .superRefine((values, context) => {
    if (!values.allDay && !TIME_PATTERN.test(values.startTime)) {
      context.addIssue({ code: 'custom', path: ['startTime'], message: 'Indiquez une heure valide (HH:MM) ou cochez « Toute la journée ».' });
    }
    if (values.recurrenceUntil !== '') {
      if (values.recurrence === 'none') {
        context.addIssue({ code: 'custom', path: ['recurrenceUntil'], message: 'Une fin de récurrence suppose un événement récurrent.' });
      } else if (!validDate(values.recurrenceUntil)) {
        context.addIssue({ code: 'custom', path: ['recurrenceUntil'], message: 'Indiquez une date de fin valide.' });
      } else if (validDate(values.startsOn) && values.recurrenceUntil < values.startsOn) {
        context.addIssue({ code: 'custom', path: ['recurrenceUntil'], message: 'La fin de la récurrence précède le début de l’événement.' });
      }
    }
    if (values.unitId !== '' && values.propertyId === '') {
      context.addIssue({ code: 'custom', path: ['unitId'], message: 'Choisissez d’abord le bien du lot.' });
    }
  })
  .transform((values): EventInput => ({
    kind: values.kind,
    title: values.title,
    notes: values.notes.trim(),
    startsOn: values.startsOn,
    startTime: values.allDay ? '' : values.startTime,
    recurrence: values.recurrence,
    recurrenceUntil: values.recurrence === 'none' ? '' : values.recurrenceUntil,
    reminderOffsetMinutes: values.reminder === '' ? null : values.reminder === '60' ? 60 : 1440,
    propertyId: values.propertyId,
    unitId: values.unitId,
    leaseId: values.leaseId,
    attendees: values.attendees,
  }));

export type EventFormValues = z.input<typeof eventFormSchema>;

export function emptyEventValues(date: string): EventFormValues {
  return {
    kind: 'appointment',
    title: '',
    notes: '',
    startsOn: date,
    allDay: false,
    startTime: '09:00',
    recurrence: 'none',
    recurrenceUntil: '',
    reminder: '',
    propertyId: '',
    unitId: '',
    leaseId: '',
    attendees: [],
  };
}

export function valuesOfEvent(event: PlanningEvent): EventFormValues {
  return {
    kind: event.kind,
    title: event.title,
    notes: event.notes ?? '',
    startsOn: event.startsOn,
    allDay: event.allDay,
    startTime: event.startTime ?? '09:00',
    recurrence: event.recurrence,
    recurrenceUntil: event.recurrenceUntil ?? '',
    reminder: event.reminderOffsetMinutes === null ? '' : event.reminderOffsetMinutes === 60 ? '60' : '1440',
    propertyId: event.propertyId ?? '',
    unitId: event.unitId ?? '',
    leaseId: event.leaseId ?? '',
    attendees: event.attendees,
  };
}

export const SERVER_FIELDS: Readonly<Record<string, keyof EventFormValues>> = {
  kind: 'kind',
  title: 'title',
  notes: 'notes',
  starts_on: 'startsOn',
  start_time: 'startTime',
  recurrence: 'recurrence',
  recurrence_until: 'recurrenceUntil',
  reminder_offset_minutes: 'reminder',
  property_id: 'propertyId',
  unit_id: 'unitId',
  lease_id: 'leaseId',
  attendees: 'attendees',
};

import { z } from 'zod';
import { invalidInput } from '../../orgapi/errors';
import { EVENT_KINDS, MAX_ATTENDEES, MAX_BULK_TASKS, RECURRENCES, REMINDER_OFFSETS } from '../model';
import type { EventInput, TaskInput } from '../model';

const MIN_DATE = '2000-01-01';
const MAX_DATE = '2100-01-01';
const NO_MARKUP = /^[^<>]*$/;

const id = z.guid();
const isRealDate = (value: string): boolean => new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => value > MIN_DATE && value < MAX_DATE && isRealDate(value));
const title = z.string().trim().min(1).max(120).regex(NO_MARKUP);

const taskBody = z.object({
  title,
  due_on: date,
  assignee_user_id: id.nullable(),
  remind_days_before: z.number().int().min(0).max(90).nullable(),
  property_id: id.nullable(),
  unit_id: id.nullable(),
  lease_id: id.nullable(),
});

const attendee = z.union([z.strictObject({ user_id: id }), z.strictObject({ party_id: id })]);

const eventBody = z.object({
  kind: z.enum(EVENT_KINDS),
  title,
  notes: z.string().trim().max(1000).regex(NO_MARKUP).nullable(),
  starts_on: date,
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  recurrence: z.enum(RECURRENCES),
  recurrence_until: date.nullable(),
  reminder_offset_minutes: z.union([z.literal(REMINDER_OFFSETS[0]), z.literal(REMINDER_OFFSETS[1])]).nullable(),
  property_id: id.nullable(),
  unit_id: id.nullable(),
  lease_id: id.nullable(),
  attendees: z.array(attendee).max(MAX_ATTENDEES),
});

const bulkIds = z.array(id).min(1).max(MAX_BULK_TASKS);

function check<S extends z.ZodType>(schema: S, value: unknown, message: string): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw invalidInput(message);
  return parsed.data;
}

const orNull = (text: string): string | null => (text.trim() === '' ? null : text.trim());

export const assertClientId = (clientId: string): string => check(id, clientId, 'L’identifiant de saisie est invalide : rechargez la page.');

export function taskPayload(input: TaskInput): z.infer<typeof taskBody> {
  return check(
    taskBody,
    {
      title: input.title,
      due_on: input.dueOn,
      assignee_user_id: orNull(input.assigneeUserId),
      remind_days_before: input.remindDaysBefore,
      property_id: orNull(input.propertyId),
      unit_id: orNull(input.unitId),
      lease_id: orNull(input.leaseId),
    },
    'La tâche est invalide : relisez le titre (sans < ni >), l’échéance et les liens.',
  );
}

export function eventPayload(input: EventInput): z.infer<typeof eventBody> {
  const recurring = input.recurrence !== 'none';
  const seen = new Set<string>();
  const attendees = input.attendees.map((entry) => {
    const key = entry.userId ?? entry.partyId ?? '';
    if (seen.has(key)) throw invalidInput('Un participant figure deux fois.');
    seen.add(key);
    return entry.userId === null ? { party_id: entry.partyId ?? '' } : { user_id: entry.userId };
  });
  const body = check(
    eventBody,
    {
      kind: input.kind,
      title: input.title,
      notes: orNull(input.notes),
      starts_on: input.startsOn,
      start_time: orNull(input.startTime),
      recurrence: input.recurrence,
      recurrence_until: recurring ? orNull(input.recurrenceUntil) : null,
      reminder_offset_minutes: input.reminderOffsetMinutes,
      property_id: orNull(input.propertyId),
      unit_id: orNull(input.unitId),
      lease_id: orNull(input.leaseId),
      attendees,
    },
    'L’événement est invalide : relisez le titre et les notes (sans < ni >), la date, l’heure et les participants (20 au plus).',
  );
  if (body.recurrence_until !== null && body.recurrence_until < body.starts_on) throw invalidInput('La fin de la récurrence précède le début de l’événement.');
  return body;
}

export const bulkIdsPayload = (ids: readonly string[]): string[] => [...new Set(check(bulkIds, [...ids], `Choisissez entre 1 et ${String(MAX_BULK_TASKS)} tâches.`))];

export const assertDueOn = (dueOn: string): string => check(date, dueOn, 'La nouvelle échéance est invalide.');
export const assertUserId = (userId: string): string => check(id, userId, 'Le responsable choisi est invalide.');
export const assertLockVersion = (lockVersion: number): number => check(z.number().int().positive(), lockVersion, 'La version de l’élément est inconnue : rechargez la page.');

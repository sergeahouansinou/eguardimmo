import { z } from 'zod';
import { EVENT_KINDS, RECURRENCES, TASK_STATUSES } from '../model';

const id = z.guid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/);
const timestamp = z.iso.datetime({ offset: true });
const kind = z.enum(EVENT_KINDS);
const recurrence = z.enum(RECURRENCES);

export const apiOccurrence = z.object({
  event_id: id,
  occurrence_on: date,
  kind,
  title: z.string(),
  start_time: time.nullable(),
  timezone: z.string().nullable(),
  all_day: z.boolean(),
  starts_at: timestamp.nullable(),
  recurrence,
  property_id: id.nullable(),
  unit_id: id.nullable(),
  lease_id: id.nullable(),
});

export const apiOccurrences = z.object({ data: z.array(apiOccurrence) });

export const apiAttendee = z.object({ user_id: id.nullable(), party_id: id.nullable() });

export const apiEvent = z.object({
  id,
  kind,
  title: z.string(),
  notes: z.string().nullable(),
  starts_on: date,
  start_time: time.nullable(),
  timezone: z.string().nullable(),
  all_day: z.boolean(),
  recurrence,
  recurrence_until: date.nullable(),
  reminder_offset_minutes: z.union([z.literal(60), z.literal(1440)]).nullable(),
  property_id: id.nullable(),
  unit_id: id.nullable(),
  lease_id: id.nullable(),
  attendees: z.array(apiAttendee),
  created_by_user_id: id,
  cancelled_at: timestamp.nullable(),
  lock_version: z.number().int().positive(),
});

export const apiEventResponse = z.object({ data: apiEvent });

export const apiTask = z.object({
  id,
  title: z.string(),
  due_on: date,
  status: z.enum(TASK_STATUSES),
  is_overdue: z.boolean(),
  assignee_user_id: id.nullable(),
  assignee_active: z.boolean().nullable(),
  done_at: timestamp.nullable(),
  done_by_user_id: id.nullable(),
  remind_days_before: z.number().int().nonnegative().nullable(),
  property_id: id.nullable(),
  unit_id: id.nullable(),
  lease_id: id.nullable(),
  created_by_user_id: id,
  lock_version: z.number().int().positive(),
});

export const apiTaskResponse = z.object({ data: apiTask });

export const apiTaskPage = z.object({
  data: z.array(apiTask),
  meta: z.object({ has_more: z.boolean(), next_cursor: z.string().nullable() }),
});

export const apiBulkResponse = z.object({ data: z.object({ count: z.number().int().nonnegative() }) });

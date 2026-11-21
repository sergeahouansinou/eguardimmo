import type { z } from 'zod';
import type { EventAttendee, Occurrence, PlanningEvent, PlanningTask, TaskPage } from '../model';
import type { apiAttendee, apiEvent, apiOccurrence, apiTask, apiTaskPage } from './schemas';

const hourMinute = (value: string | null): string | null => (value === null ? null : value.slice(0, 5));

export function toOccurrence(row: z.infer<typeof apiOccurrence>): Occurrence {
  return {
    eventId: row.event_id,
    occurrenceOn: row.occurrence_on,
    kind: row.kind,
    title: row.title,
    startTime: hourMinute(row.start_time),
    timezone: row.timezone,
    allDay: row.all_day,
    startsAt: row.starts_at,
    recurrence: row.recurrence,
    propertyId: row.property_id,
    unitId: row.unit_id,
    leaseId: row.lease_id,
  };
}

const toAttendee = (row: z.infer<typeof apiAttendee>): EventAttendee => ({ userId: row.user_id, partyId: row.party_id });

export function toEvent(row: z.infer<typeof apiEvent>): PlanningEvent {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    notes: row.notes,
    startsOn: row.starts_on,
    startTime: hourMinute(row.start_time),
    timezone: row.timezone,
    allDay: row.all_day,
    recurrence: row.recurrence,
    recurrenceUntil: row.recurrence_until,
    reminderOffsetMinutes: row.reminder_offset_minutes,
    propertyId: row.property_id,
    unitId: row.unit_id,
    leaseId: row.lease_id,
    attendees: row.attendees.map(toAttendee),
    createdByUserId: row.created_by_user_id,
    cancelledAt: row.cancelled_at,
    lockVersion: row.lock_version,
  };
}

export function toTask(row: z.infer<typeof apiTask>): PlanningTask {
  return {
    id: row.id,
    title: row.title,
    dueOn: row.due_on,
    status: row.status,
    isOverdue: row.is_overdue,
    assigneeUserId: row.assignee_user_id,
    assigneeActive: row.assignee_active,
    doneAt: row.done_at,
    doneByUserId: row.done_by_user_id,
    remindDaysBefore: row.remind_days_before,
    propertyId: row.property_id,
    unitId: row.unit_id,
    leaseId: row.lease_id,
    createdByUserId: row.created_by_user_id,
    lockVersion: row.lock_version,
  };
}

export function toTaskPage(page: z.infer<typeof apiTaskPage>): TaskPage {
  return { items: page.data.map(toTask), nextCursor: page.meta.has_more ? page.meta.next_cursor : null };
}

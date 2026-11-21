export const EVENT_KINDS = ['visit', 'appointment', 'deadline', 'reminder'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const RECURRENCES = ['none', 'weekly', 'monthly', 'yearly'] as const;
export type Recurrence = (typeof RECURRENCES)[number];

export const REMINDER_OFFSETS = [60, 1440] as const;
export type ReminderOffset = (typeof REMINDER_OFFSETS)[number];

export const TASK_STATUSES = ['open', 'done', 'cancelled'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const MAX_ATTENDEES = 20;
export const MAX_BULK_TASKS = 100;
export const MAX_RANGE_DAYS = 62;

export interface Occurrence {
  eventId: string;
  occurrenceOn: string;
  kind: EventKind;
  title: string;
  startTime: string | null;
  timezone: string | null;
  allDay: boolean;
  startsAt: string | null;
  recurrence: Recurrence;
  propertyId: string | null;
  unitId: string | null;
  leaseId: string | null;
}

export interface EventAttendee {
  userId: string | null;
  partyId: string | null;
}

export interface PlanningEvent {
  id: string;
  kind: EventKind;
  title: string;
  notes: string | null;
  startsOn: string;
  startTime: string | null;
  timezone: string | null;
  allDay: boolean;
  recurrence: Recurrence;
  recurrenceUntil: string | null;
  reminderOffsetMinutes: ReminderOffset | null;
  propertyId: string | null;
  unitId: string | null;
  leaseId: string | null;
  attendees: EventAttendee[];
  createdByUserId: string;
  cancelledAt: string | null;
  lockVersion: number;
}

export interface EventInput {
  kind: EventKind;
  title: string;
  notes: string;
  startsOn: string;
  startTime: string;
  recurrence: Recurrence;
  recurrenceUntil: string;
  reminderOffsetMinutes: ReminderOffset | null;
  propertyId: string;
  unitId: string;
  leaseId: string;
  attendees: EventAttendee[];
}

export interface PlanningTask {
  id: string;
  title: string;
  dueOn: string;
  status: TaskStatus;
  isOverdue: boolean;
  assigneeUserId: string | null;
  assigneeActive: boolean | null;
  doneAt: string | null;
  doneByUserId: string | null;
  remindDaysBefore: number | null;
  propertyId: string | null;
  unitId: string | null;
  leaseId: string | null;
  createdByUserId: string;
  lockVersion: number;
}

export interface TaskInput {
  title: string;
  dueOn: string;
  assigneeUserId: string;
  remindDaysBefore: number | null;
  propertyId: string;
  unitId: string;
  leaseId: string;
}

export interface TaskQuery {
  cursor?: string | null;
  perPage?: number;
  status?: TaskStatus | null;
  assignee?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  dueFrom?: string | null;
  dueTo?: string | null;
  overdue?: boolean;
}

export interface TaskPage {
  items: PlanningTask[];
  nextCursor: string | null;
}

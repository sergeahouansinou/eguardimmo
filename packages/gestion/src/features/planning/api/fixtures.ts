export const IDS = {
  org: '0198a0a0-0000-7000-8000-000000000001',
  user: '0198a0a0-0000-7000-8000-0000000000a1',
  colleague: '0198a0a0-0000-7000-8000-0000000000a2',
  property: '0198a0a0-0000-7000-8000-0000000000b1',
  unit: '0198a0a0-0000-7000-8000-0000000000b2',
  lease: '0198a0a0-0000-7000-8000-0000000000b3',
  party: '0198a0a0-0000-7000-8000-0000000000c1',
  event: '0198a0a0-0000-7000-8000-0000000000e1',
  task: '0198a0a0-0000-7000-8000-0000000000f1',
  taskDone: '0198a0a0-0000-7000-8000-0000000000f2',
  taskCancelled: '0198a0a0-0000-7000-8000-0000000000f3',
  clientKey: '0198a0a0-0000-7000-8000-0000000000d1',
} as const;

export const occurrence = {
  event_id: IDS.event,
  occurrence_on: '2026-03-29',
  kind: 'visit',
  title: 'Visite du T2',
  start_time: '09:30',
  timezone: 'Europe/Paris',
  all_day: false,
  starts_at: '2026-03-29T07:30:00Z',
  recurrence: 'weekly',
  property_id: IDS.property,
  unit_id: IDS.unit,
  lease_id: null,
};

export const allDayOccurrence = { ...occurrence, kind: 'deadline', title: 'Échéance assurance', start_time: null, timezone: null, all_day: true, starts_at: null, recurrence: 'none', unit_id: null };

export const event = {
  id: IDS.event,
  kind: 'visit',
  title: 'Visite du T2',
  notes: 'Prévoir les clés',
  starts_on: '2026-03-29',
  start_time: '09:30',
  timezone: 'Europe/Paris',
  all_day: false,
  recurrence: 'weekly',
  recurrence_until: '2026-06-28',
  reminder_offset_minutes: 60,
  property_id: IDS.property,
  unit_id: IDS.unit,
  lease_id: null,
  attendees: [
    { user_id: IDS.colleague, party_id: null },
    { user_id: null, party_id: IDS.party },
  ],
  created_by_user_id: IDS.user,
  cancelled_at: null,
  lock_version: 2,
};

export const task = {
  id: IDS.task,
  title: 'Relancer le syndic',
  due_on: '2026-03-20',
  status: 'open',
  is_overdue: true,
  assignee_user_id: IDS.colleague,
  assignee_active: true,
  done_at: null,
  done_by_user_id: null,
  remind_days_before: 3,
  property_id: IDS.property,
  unit_id: null,
  lease_id: null,
  created_by_user_id: IDS.user,
  lock_version: 1,
};

export const doneTask = { ...task, id: IDS.taskDone, status: 'done', is_overdue: false, done_at: '2026-03-19T10:15:00+01:00', done_by_user_id: IDS.user, lock_version: 2 };
export const cancelledTask = { ...task, id: IDS.taskCancelled, status: 'cancelled', is_overdue: false, assignee_user_id: null, assignee_active: null, lock_version: 3 };

export const taskPage = (tasks: readonly unknown[], nextCursor: string | null = null) => ({ data: tasks, meta: { has_more: nextCursor !== null, next_cursor: nextCursor } });

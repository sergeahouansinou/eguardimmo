import { describe, expect, it } from 'vitest';
import { problem } from '../../orgapi/testing';
import type { EventInput, TaskInput } from '../model';
import { OrgApiError } from '../../orgapi/errors';
import { createApiPlanningSource } from './source';
import * as api from './fixtures';
import { mockPlanningApi, orgPath } from './testing';
import type { MockRoute } from './testing';

const url = (path: string) => orgPath(api.IDS.org, `/planning${path}`);

function setup(routes: Record<string, MockRoute>) {
  const mock = mockPlanningApi(routes);
  const source = createApiPlanningSource({ client: mock.client, organizationId: api.IDS.org }, { fetchImpl: mock.fetchImpl });
  return { source, ...mock };
}

const eventInput: EventInput = {
  kind: 'visit',
  title: ' Visite du T2 ',
  notes: '',
  startsOn: '2026-03-29',
  startTime: '09:30',
  recurrence: 'weekly',
  recurrenceUntil: '2026-06-28',
  reminderOffsetMinutes: 60,
  propertyId: api.IDS.property,
  unitId: api.IDS.unit,
  leaseId: '',
  attendees: [{ userId: api.IDS.colleague, partyId: null }, { userId: null, partyId: api.IDS.party }],
};

const taskInput: TaskInput = { title: 'Relancer le syndic', dueOn: '2026-03-20', assigneeUserId: api.IDS.colleague, remindDaysBefore: 3, propertyId: api.IDS.property, unitId: '', leaseId: '' };

describe('source API du planning : lectures', () => {
  it('lit les occurrences sur la plage demandée et normalise les heures', async () => {
    const { source, calls } = setup({ [`GET ${url('/events')}`]: { body: { data: [api.occurrence, { ...api.allDayOccurrence, start_time: null }] } } });

    const rows = await source.occurrences('2026-03-23', '2026-04-27');

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ eventId: api.IDS.event, occurrenceOn: '2026-03-29', startTime: '09:30', startsAt: '2026-03-29T07:30:00Z', allDay: false, recurrence: 'weekly' });
    expect(rows[1]).toMatchObject({ allDay: true, startTime: null, startsAt: null });
    expect(calls[0]?.search.get('from')).toBe('2026-03-23');
    expect(calls[0]?.search.get('to')).toBe('2026-04-27');
  });

  it.each([['2026-03-01', '2026-03-01'], ['2026-03-10', '2026-03-01'], ['2026-03-01', '2026-05-15']])('refuse la plage %s → %s sans appeler le serveur', async (from, to) => {
    const { source, calls } = setup({});

    await expect(source.occurrences(from, to)).rejects.toMatchObject({ kind: 'invalid' });
    expect(calls).toHaveLength(0);
  });

  it('lit un événement avec participants et version', async () => {
    const { source } = setup({ [`GET ${url(`/events/${api.IDS.event}`)}`]: { body: { data: api.event } } });

    const event = await source.event(api.IDS.event);

    expect(event).toMatchObject({ id: api.IDS.event, lockVersion: 2, reminderOffsetMinutes: 60, recurrenceUntil: '2026-06-28', cancelledAt: null });
    expect(event.attendees).toEqual([{ userId: api.IDS.colleague, partyId: null }, { userId: null, partyId: api.IDS.party }]);
  });

  it('lit la liste des tâches avec filtres et curseur', async () => {
    const { source, calls } = setup({ [`GET ${url('/tasks')}`]: { body: api.taskPage([api.task], 'curseur-2') } });

    const page = await source.tasks({ cursor: 'curseur-1', status: 'open', assignee: 'me', propertyId: api.IDS.property, unitId: api.IDS.unit, dueFrom: '2026-03-01', dueTo: '2026-04-01', overdue: true });

    expect(page.nextCursor).toBe('curseur-2');
    expect(page.items[0]).toMatchObject({ id: api.IDS.task, isOverdue: true, assigneeActive: true, remindDaysBefore: 3, lockVersion: 1 });
    const search = calls[0]?.search;
    expect(Object.fromEntries(search ?? [])).toEqual({ cursor: 'curseur-1', per_page: '25', status: 'open', assignee: 'me', property: api.IDS.property, unit: api.IDS.unit, due_from: '2026-03-01', due_to: '2026-04-01', overdue: 'true' });
  });

  it('ne rend aucun curseur quand le serveur n’annonce pas de page suivante', async () => {
    const { source } = setup({ [`GET ${url('/tasks')}`]: { body: { data: [api.task], meta: { has_more: false, next_cursor: 'inutile' } } } });

    expect((await source.tasks({})).nextCursor).toBeNull();
  });

  it('lit une tâche par un appel direct, quel que soit son statut', async () => {
    const { source, calls } = setup({ [`GET ${url(`/tasks/${api.IDS.taskCancelled}`)}`]: { body: { data: api.cancelledTask } } });

    const found = await source.task(api.IDS.taskCancelled);

    expect(found).toMatchObject({ id: api.IDS.taskCancelled, status: 'cancelled', assigneeUserId: null });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.search.size).toBe(0);
  });

  it('rend un 404 explicite pour une tâche introuvable', async () => {
    const { source } = setup({ [`GET ${url(`/tasks/${api.IDS.task}`)}`]: problem(404, 'planning_task_not_found') });

    await expect(source.task(api.IDS.task)).rejects.toMatchObject({ kind: 'not_found', code: 'planning_task_not_found' });
  });

  it('rejette une tâche dont la réponse sort du contrat', async () => {
    const { source } = setup({ [`GET ${url(`/tasks/${api.IDS.task}`)}`]: { body: { data: { ...api.task, status: 'archived' } } } });

    await expect(source.task(api.IDS.task)).rejects.toMatchObject({ kind: 'unexpected_response' });
  });

  it('rejette une réponse hors contrat', async () => {
    const { source } = setup({ [`GET ${url('/tasks')}`]: { body: { data: [{ ...api.task, status: 'archived' }], meta: { has_more: false, next_cursor: null } } } });

    await expect(source.tasks({})).rejects.toMatchObject({ kind: 'unexpected_response' });
  });
});

describe('source API du planning : événements', () => {
  it('crée un événement : champs vides à null, participants discriminés, titre rogné', async () => {
    const { source, calls } = setup({ [`POST ${url('/events')}`]: { status: 201, body: { data: api.event } } });

    const created = await source.createEvent(eventInput);

    expect(created.id).toBe(api.IDS.event);
    expect(calls[0]?.body).toEqual({
      kind: 'visit',
      title: 'Visite du T2',
      notes: null,
      starts_on: '2026-03-29',
      start_time: '09:30',
      recurrence: 'weekly',
      recurrence_until: '2026-06-28',
      reminder_offset_minutes: 60,
      property_id: api.IDS.property,
      unit_id: api.IDS.unit,
      lease_id: null,
      attendees: [{ user_id: api.IDS.colleague }, { party_id: api.IDS.party }],
    });
  });

  it('n’envoie pas de fin de récurrence pour un événement ponctuel', async () => {
    const { source, calls } = setup({ [`POST ${url('/events')}`]: { status: 201, body: { data: api.event } } });

    await source.createEvent({ ...eventInput, recurrence: 'none' });

    expect((calls[0]?.body as Record<string, unknown>).recurrence_until).toBeNull();
  });

  it.each([
    ['titre avec balise', { title: 'Visite <b>' }],
    ['plus de 20 participants', { attendees: Array.from({ length: 21 }, (_, index) => ({ userId: `0198a0a0-0000-7000-8000-${String(index).padStart(12, '0')}`, partyId: null })) }],
    ['participant en double', { attendees: [{ userId: api.IDS.colleague, partyId: null }, { userId: api.IDS.colleague, partyId: null }] }],
    ['rappel hors liste', { reminderOffsetMinutes: 30 as never }],
    ['heure invalide', { startTime: '25:00' }],
    ['date inexistante', { startsOn: '2026-02-31' }],
    ['fin avant le début', { recurrenceUntil: '2026-01-01' }],
  ])('refuse sans appel : %s', async (_label, patch) => {
    const { source, calls } = setup({});

    await expect(source.createEvent({ ...eventInput, ...patch })).rejects.toMatchObject({ kind: 'invalid' });
    expect(calls).toHaveLength(0);
  });

  it('modifie un événement avec lock_version', async () => {
    const { source, calls } = setup({ [`PATCH ${url(`/events/${api.IDS.event}`)}`]: { body: { data: { ...api.event, lock_version: 3 } } } });

    const updated = await source.updateEvent(api.IDS.event, 2, eventInput);

    expect(updated.lockVersion).toBe(3);
    expect((calls[0]?.body as Record<string, unknown>).lock_version).toBe(2);
  });

  it('classe le conflit de version en « stale » avec le message du catalogue', async () => {
    const { source } = setup({ [`PATCH ${url(`/events/${api.IDS.event}`)}`]: problem(409, 'planning_version_conflict') });

    const failure = await source.updateEvent(api.IDS.event, 1, eventInput).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(OrgApiError);
    expect(failure).toMatchObject({ kind: 'stale', status: 409, code: 'planning_version_conflict' });
    expect((failure as Error).message).toContain('rechargé');
  });

  it('classe un événement annulé en conflit', async () => {
    const { source } = setup({ [`PATCH ${url(`/events/${api.IDS.event}`)}`]: problem(409, 'planning_event_cancelled') });

    await expect(source.updateEvent(api.IDS.event, 1, eventInput)).rejects.toMatchObject({ kind: 'conflict', message: 'Un événement annulé ne se modifie plus.' });
  });

  it('refuse une série de trop et un lien invalide (422)', async () => {
    const limit = setup({ [`POST ${url('/events')}`]: problem(422, 'planning_series_limit_reached') });
    const link = setup({ [`POST ${url('/events')}`]: problem(422, 'planning_link_invalid') });

    await expect(limit.source.createEvent(eventInput)).rejects.toMatchObject({ kind: 'invalid', code: 'planning_series_limit_reached' });
    await expect(link.source.createEvent(eventInput)).rejects.toMatchObject({ kind: 'invalid', code: 'planning_link_invalid' });
  });

  it('annule un événement', async () => {
    const { source, calls } = setup({ [`POST ${url(`/events/${api.IDS.event}/cancel`)}`]: { body: { data: { ...api.event, cancelled_at: '2026-03-10T09:00:00+00:00', lock_version: 3 } } } });

    const cancelled = await source.cancelEvent(api.IDS.event);

    expect(cancelled.cancelledAt).toBe('2026-03-10T09:00:00+00:00');
    expect(calls[0]?.method).toBe('POST');
  });
});

describe('source API du planning : tâches', () => {
  it('crée une tâche avec client_id, liens vides à null (201)', async () => {
    const { source, calls } = setup({ [`POST ${url('/tasks')}`]: { status: 201, body: { data: api.task } } });

    const created = await source.createTask(taskInput, api.IDS.clientKey);

    expect(created.id).toBe(api.IDS.task);
    expect(calls[0]?.body).toEqual({ title: 'Relancer le syndic', due_on: '2026-03-20', assignee_user_id: api.IDS.colleague, remind_days_before: 3, property_id: api.IDS.property, unit_id: null, lease_id: null, client_id: api.IDS.clientKey });
  });

  it('accepte le rejeu idempotent (200) et refuse un client_id réutilisé (409)', async () => {
    const replay = setup({ [`POST ${url('/tasks')}`]: { status: 200, body: { data: api.task } } });
    const reused = setup({ [`POST ${url('/tasks')}`]: problem(409, 'idempotency_key_reused') });

    await expect(replay.source.createTask(taskInput, api.IDS.clientKey)).resolves.toMatchObject({ id: api.IDS.task });
    await expect(reused.source.createTask(taskInput, api.IDS.clientKey)).rejects.toMatchObject({ kind: 'conflict', code: 'idempotency_key_reused' });
  });

  it('refuse sans appel un titre vide, avec balise, une échéance hors bornes ou un client_id invalide', async () => {
    const { source, calls } = setup({});

    await expect(source.createTask({ ...taskInput, title: '  ' }, api.IDS.clientKey)).rejects.toMatchObject({ kind: 'invalid' });
    await expect(source.createTask({ ...taskInput, title: 'a<b' }, api.IDS.clientKey)).rejects.toMatchObject({ kind: 'invalid' });
    await expect(source.createTask({ ...taskInput, dueOn: '2100-01-01' }, api.IDS.clientKey)).rejects.toMatchObject({ kind: 'invalid' });
    await expect(source.createTask({ ...taskInput, remindDaysBefore: 91 }, api.IDS.clientKey)).rejects.toMatchObject({ kind: 'invalid' });
    await expect(source.createTask(taskInput, 'pas-un-uuid')).rejects.toMatchObject({ kind: 'invalid' });
    expect(calls).toHaveLength(0);
  });

  it('remonte un responsable invalide (422)', async () => {
    const { source } = setup({ [`POST ${url('/tasks')}`]: problem(422, 'planning_assignee_invalid') });

    await expect(source.createTask(taskInput, api.IDS.clientKey)).rejects.toMatchObject({ kind: 'invalid', message: 'Le responsable doit être un membre actif de votre organisation.' });
  });

  it('modifie une tâche avec lock_version et conflit « stale »', async () => {
    const ok = setup({ [`PATCH ${url(`/tasks/${api.IDS.task}`)}`]: { body: { data: { ...api.task, lock_version: 2 } } } });
    const conflict = setup({ [`PATCH ${url(`/tasks/${api.IDS.task}`)}`]: problem(409, 'planning_version_conflict') });

    expect((await ok.source.updateTask(api.IDS.task, 1, taskInput)).lockVersion).toBe(2);
    expect((ok.calls[0]?.body as Record<string, unknown>).lock_version).toBe(1);
    await expect(conflict.source.updateTask(api.IDS.task, 1, taskInput)).rejects.toMatchObject({ kind: 'stale' });
  });

  it.each([
    ['complete', 'completeTask', 'done'],
    ['reopen', 'reopenTask', 'open'],
    ['cancel', 'cancelTask', 'cancelled'],
  ] as const)('change le statut : %s', async (action, method, status) => {
    const { source, calls } = setup({ [`POST ${url(`/tasks/${api.IDS.task}/${action}`)}`]: { body: { data: { ...api.task, status } } } });

    expect((await source[method](api.IDS.task)).status).toBe(status);
    expect(calls[0]?.method).toBe('POST');
  });

  it('refuse de clôturer une tâche déjà fermée (409 « stale »)', async () => {
    const { source } = setup({ [`POST ${url(`/tasks/${api.IDS.task}/complete`)}`]: problem(409, 'planning_task_not_open') });

    await expect(source.completeTask(api.IDS.task)).rejects.toMatchObject({ kind: 'stale', code: 'planning_task_not_open' });
  });

  it('exécute les actions groupées et rend le nombre de tâches traitées', async () => {
    const { source, calls } = setup({
      [`POST ${url('/tasks/bulk/complete')}`]: { body: { data: { count: 2 } } },
      [`POST ${url('/tasks/bulk/postpone')}`]: { body: { data: { count: 2 } } },
      [`POST ${url('/tasks/bulk/assign')}`]: { body: { data: { count: 1 } } },
    });
    const ids = [api.IDS.task, api.IDS.taskDone, api.IDS.task];

    expect(await source.bulkComplete(ids)).toBe(2);
    expect(await source.bulkPostpone(ids, '2026-04-01')).toBe(2);
    expect(await source.bulkAssign([api.IDS.task], api.IDS.colleague)).toBe(1);
    expect(calls[0]?.body).toEqual({ ids: [api.IDS.task, api.IDS.taskDone] });
    expect(calls[1]?.body).toEqual({ ids: [api.IDS.task, api.IDS.taskDone], due_on: '2026-04-01' });
    expect(calls[2]?.body).toEqual({ ids: [api.IDS.task], assignee_user_id: api.IDS.colleague });
  });

  it('refuse sans appel un lot vide ou de plus de 100 tâches', async () => {
    const { source, calls } = setup({});
    const many = Array.from({ length: 101 }, (_, index) => `0198a0a0-0000-7000-8000-${String(index).padStart(12, '0')}`);

    await expect(source.bulkComplete([])).rejects.toMatchObject({ kind: 'invalid' });
    await expect(source.bulkComplete(many)).rejects.toMatchObject({ kind: 'invalid' });
    expect(calls).toHaveLength(0);
  });

  it('remonte lot inconnu (404) et lot trop grand côté serveur (422)', async () => {
    const unknown = setup({ [`POST ${url('/tasks/bulk/complete')}`]: problem(404, 'planning_task_not_found') });
    const big = setup({ [`POST ${url('/tasks/bulk/postpone')}`]: problem(422, 'planning_bulk_too_large') });

    await expect(unknown.source.bulkComplete([api.IDS.task])).rejects.toMatchObject({ kind: 'not_found' });
    await expect(big.source.bulkPostpone([api.IDS.task], '2026-04-01')).rejects.toMatchObject({ kind: 'invalid', code: 'planning_bulk_too_large' });
  });
});

describe('source API du planning : erreurs transverses', () => {
  const operations: Record<string, (source: ReturnType<typeof setup>['source']) => Promise<unknown>> = {
    occurrences: (source) => source.occurrences('2026-03-01', '2026-04-01'),
    event: (source) => source.event(api.IDS.event),
    createEvent: (source) => source.createEvent(eventInput),
    updateEvent: (source) => source.updateEvent(api.IDS.event, 1, eventInput),
    cancelEvent: (source) => source.cancelEvent(api.IDS.event),
    tasks: (source) => source.tasks({}),
    task: (source) => source.task(api.IDS.task),
    createTask: (source) => source.createTask(taskInput, api.IDS.clientKey),
    updateTask: (source) => source.updateTask(api.IDS.task, 1, taskInput),
    completeTask: (source) => source.completeTask(api.IDS.task),
    reopenTask: (source) => source.reopenTask(api.IDS.task),
    cancelTask: (source) => source.cancelTask(api.IDS.task),
    bulkComplete: (source) => source.bulkComplete([api.IDS.task]),
    bulkPostpone: (source) => source.bulkPostpone([api.IDS.task], '2026-04-01'),
    bulkAssign: (source) => source.bulkAssign([api.IDS.task], api.IDS.colleague),
  };
  const statuses = [
    [401, 'unauthenticated', 'unauthenticated'],
    [403, 'role_forbidden', 'forbidden'],
    [404, 'planning_event_not_found', 'not_found'],
    [429, 'too_many_requests', 'rate_limited'],
  ] as const;

  it.each(Object.keys(operations).flatMap((name) => statuses.map(([status, code, kind]) => [name, status, code, kind] as const)))('%s : HTTP %i rend le type « %s »', async (name, status, code, kind) => {
    const catchAll: MockRoute = status === 429 ? { status, body: { type: 'about:blank', title: 'x', status, code }, headers: { 'Retry-After': '30' } } : problem(status, code);
    const { source } = setup(
      Object.fromEntries(['GET', 'POST', 'PATCH'].flatMap((method) => [`${method} ${url('/events')}`, `${method} ${url('/tasks')}`, `${method} ${url(`/events/${api.IDS.event}`)}`, `${method} ${url(`/events/${api.IDS.event}/cancel`)}`, `${method} ${url(`/tasks/${api.IDS.task}`)}`, `${method} ${url(`/tasks/${api.IDS.task}/complete`)}`, `${method} ${url(`/tasks/${api.IDS.task}/reopen`)}`, `${method} ${url(`/tasks/${api.IDS.task}/cancel`)}`, `${method} ${url('/tasks/bulk/complete')}`, `${method} ${url('/tasks/bulk/postpone')}`, `${method} ${url('/tasks/bulk/assign')}`].map((key) => [key, catchAll]))),
    );

    const operation = operations[name];
    await expect(operation === undefined ? Promise.reject(new Error('opération inconnue')) : operation(source)).rejects.toMatchObject({ kind, status });
  });

  it('indique le délai d’attente sur un 429', async () => {
    const { source } = setup({ [`GET ${url('/tasks')}`]: { status: 429, body: { type: 'about:blank', title: 'x', status: 429, code: 'too_many_requests' }, headers: { 'Retry-After': '30' } } });

    await expect(source.tasks({})).rejects.toMatchObject({ kind: 'rate_limited', message: expect.stringContaining('30 secondes') as string });
  });

  it('refuse d’appeler le serveur sans organisation', async () => {
    const mock = mockPlanningApi({});
    const source = createApiPlanningSource({ client: mock.client, organizationId: null }, { fetchImpl: mock.fetchImpl });

    await expect(source.tasks({})).rejects.toMatchObject({ kind: 'no_organization' });
    expect(mock.calls).toHaveLength(0);
  });
});

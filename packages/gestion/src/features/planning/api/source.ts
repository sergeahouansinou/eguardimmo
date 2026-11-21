import type { ApiClient, Query } from '@eguardimmo/api';
import { invalidInput } from '../../orgapi/errors';
import { createOrgTransport } from '../../orgapi/transport';
import { MAX_RANGE_DAYS } from '../model';
import type { PlanningTask, TaskQuery } from '../model';
import type { PlanningSource } from '../source';
import { translatePlanningError } from './errors';
import { toEvent, toOccurrence, toTask, toTaskPage } from './mapping';
import { assertClientId, assertDueOn, assertLockVersion, assertUserId, bulkIdsPayload, eventPayload, taskPayload } from './payloads';
import { apiBulkResponse, apiEventResponse, apiOccurrences, apiTaskPage, apiTaskResponse } from './schemas';

export interface ApiPlanningSourceOptions {
  client: ApiClient;
  organizationId: string | null;
}

export interface ApiPlanningSourceDependencies {
  fetchImpl?: typeof fetch;
}

const PAGE_SIZE = 25;
const DAY_MS = 86_400_000;
const segment = (id: string): string => encodeURIComponent(id);
const planning = (path: string): string => `/planning${path}`;

const daysBetween = (from: string, to: string): number => (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS;

export function taskQueryParams(query: TaskQuery, perPage: number): Query {
  return {
    cursor: query.cursor ?? undefined,
    per_page: query.perPage ?? perPage,
    status: query.status ?? undefined,
    assignee: query.assignee ?? undefined,
    property: query.propertyId ?? undefined,
    unit: query.unitId ?? undefined,
    due_from: query.dueFrom ?? undefined,
    due_to: query.dueTo ?? undefined,
    overdue: query.overdue === true ? true : undefined,
  };
}

export function createApiPlanningSource({ client, organizationId }: ApiPlanningSourceOptions, { fetchImpl }: ApiPlanningSourceDependencies = {}): PlanningSource {
  const transport = createOrgTransport(client, organizationId, translatePlanningError, fetchImpl);

  const taskAction = async (id: string, action: 'complete' | 'reopen' | 'cancel'): Promise<PlanningTask> => {
    const { data } = await transport.post(planning(`/tasks/${segment(id)}/${action}`), apiTaskResponse);
    return toTask(data);
  };

  const bulk = async (action: 'complete' | 'postpone' | 'assign', body: Record<string, unknown>): Promise<number> => {
    const { data } = await transport.post(planning(`/tasks/bulk/${action}`), apiBulkResponse, { body });
    return data.count;
  };

  return {
    occurrences: async (from, to) => {
      const span = daysBetween(from, to);
      if (!Number.isFinite(span) || span <= 0 || span > MAX_RANGE_DAYS) throw invalidInput(`La période affichée doit couvrir entre 1 et ${String(MAX_RANGE_DAYS)} jours.`);
      const { data } = await transport.get(planning('/events'), apiOccurrences, { from, to });
      return data.map(toOccurrence);
    },
    event: async (id) => toEvent((await transport.get(planning(`/events/${segment(id)}`), apiEventResponse)).data),
    createEvent: async (input) => toEvent((await transport.post(planning('/events'), apiEventResponse, { body: eventPayload(input) })).data),
    updateEvent: async (id, lockVersion, input) =>
      toEvent((await transport.patch(planning(`/events/${segment(id)}`), apiEventResponse, { ...eventPayload(input), lock_version: assertLockVersion(lockVersion) })).data),
    cancelEvent: async (id) => toEvent((await transport.post(planning(`/events/${segment(id)}/cancel`), apiEventResponse)).data),
    tasks: async (query) => toTaskPage(await transport.get(planning('/tasks'), apiTaskPage, taskQueryParams(query, PAGE_SIZE))),
    task: async (id) => toTask((await transport.get(planning(`/tasks/${segment(id)}`), apiTaskResponse)).data),
    createTask: async (input, clientId) => toTask((await transport.post(planning('/tasks'), apiTaskResponse, { body: { ...taskPayload(input), client_id: assertClientId(clientId) } })).data),
    updateTask: async (id, lockVersion, input) =>
      toTask((await transport.patch(planning(`/tasks/${segment(id)}`), apiTaskResponse, { ...taskPayload(input), lock_version: assertLockVersion(lockVersion) })).data),
    completeTask: (id) => taskAction(id, 'complete'),
    reopenTask: (id) => taskAction(id, 'reopen'),
    cancelTask: (id) => taskAction(id, 'cancel'),
    bulkComplete: async (ids) => bulk('complete', { ids: bulkIdsPayload(ids) }),
    bulkPostpone: async (ids, dueOn) => bulk('postpone', { ids: bulkIdsPayload(ids), due_on: assertDueOn(dueOn) }),
    bulkAssign: async (ids, assigneeUserId) => bulk('assign', { ids: bulkIdsPayload(ids), assignee_user_id: assertUserId(assigneeUserId) }),
  };
}

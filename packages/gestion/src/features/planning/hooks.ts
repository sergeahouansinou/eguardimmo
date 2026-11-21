'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrgQuery } from '../orgapi/hooks';
import type { EventInput, TaskInput, TaskQuery } from './model';
import { usePlanningSource } from './source';

export const PLANNING_ROOT = ['gestion', 'planning'] as const;

export const planningKeys = {
  occurrences: (from: string, to: string) => [...PLANNING_ROOT, 'occurrences', from, to] as const,
  event: (id: string) => [...PLANNING_ROOT, 'event', id] as const,
  tasks: (query: TaskQuery) => [...PLANNING_ROOT, 'tasks', query] as const,
  task: (id: string) => [...PLANNING_ROOT, 'task', id] as const,
};

export function useOccurrences(from: string, to: string, enabled = true) {
  const source = usePlanningSource();
  return useOrgQuery(planningKeys.occurrences(from, to), () => source.occurrences(from, to), { enabled });
}

export function usePlanningEvent(id: string) {
  const source = usePlanningSource();
  return useOrgQuery(planningKeys.event(id), () => source.event(id));
}

export function useTasks(query: TaskQuery, enabled = true) {
  const source = usePlanningSource();
  return useOrgQuery(planningKeys.tasks(query), () => source.tasks(query), { enabled });
}

export function usePlanningTask(id: string) {
  const source = usePlanningSource();
  return useOrgQuery(planningKeys.task(id), () => source.task(id));
}

function usePlanningMutation<I, O>(run: (input: I) => Promise<O>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSettled: () => client.invalidateQueries({ queryKey: PLANNING_ROOT }),
  });
}

export function useCreateEvent() {
  const source = usePlanningSource();
  return usePlanningMutation((input: EventInput) => source.createEvent(input));
}

export function useUpdateEvent() {
  const source = usePlanningSource();
  return usePlanningMutation(({ id, lockVersion, input }: { id: string; lockVersion: number; input: EventInput }) => source.updateEvent(id, lockVersion, input));
}

export function useCancelEvent() {
  const source = usePlanningSource();
  return usePlanningMutation((id: string) => source.cancelEvent(id));
}

export function useCreateTask() {
  const source = usePlanningSource();
  return usePlanningMutation(({ input, clientId }: { input: TaskInput; clientId: string }) => source.createTask(input, clientId));
}

export function useUpdateTask() {
  const source = usePlanningSource();
  return usePlanningMutation(({ id, lockVersion, input }: { id: string; lockVersion: number; input: TaskInput }) => source.updateTask(id, lockVersion, input));
}

export function useCompleteTask() {
  const source = usePlanningSource();
  return usePlanningMutation((id: string) => source.completeTask(id));
}

export function useReopenTask() {
  const source = usePlanningSource();
  return usePlanningMutation((id: string) => source.reopenTask(id));
}

export function useCancelTask() {
  const source = usePlanningSource();
  return usePlanningMutation((id: string) => source.cancelTask(id));
}

export function useBulkComplete() {
  const source = usePlanningSource();
  return usePlanningMutation((ids: readonly string[]) => source.bulkComplete(ids));
}

export function useBulkPostpone() {
  const source = usePlanningSource();
  return usePlanningMutation(({ ids, dueOn }: { ids: readonly string[]; dueOn: string }) => source.bulkPostpone(ids, dueOn));
}

export function useBulkAssign() {
  const source = usePlanningSource();
  return usePlanningMutation(({ ids, assigneeUserId }: { ids: readonly string[]; assigneeUserId: string }) => source.bulkAssign(ids, assigneeUserId));
}

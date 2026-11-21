'use client';

import { MissingSourceError, createSourceContext } from '../locataires/kit/sourceContext';
import type { EventInput, Occurrence, PlanningEvent, PlanningTask, TaskInput, TaskPage, TaskQuery } from './model';

export interface PlanningSource {
  occurrences: (from: string, to: string) => Promise<Occurrence[]>;
  event: (id: string) => Promise<PlanningEvent>;
  createEvent: (input: EventInput) => Promise<PlanningEvent>;
  updateEvent: (id: string, lockVersion: number, input: EventInput) => Promise<PlanningEvent>;
  cancelEvent: (id: string) => Promise<PlanningEvent>;
  tasks: (query: TaskQuery) => Promise<TaskPage>;
  task: (id: string) => Promise<PlanningTask>;
  createTask: (input: TaskInput, clientId: string) => Promise<PlanningTask>;
  updateTask: (id: string, lockVersion: number, input: TaskInput) => Promise<PlanningTask>;
  completeTask: (id: string) => Promise<PlanningTask>;
  reopenTask: (id: string) => Promise<PlanningTask>;
  cancelTask: (id: string) => Promise<PlanningTask>;
  bulkComplete: (ids: readonly string[]) => Promise<number>;
  bulkPostpone: (ids: readonly string[], dueOn: string) => Promise<number>;
  bulkAssign: (ids: readonly string[], assigneeUserId: string) => Promise<number>;
}

const context = createSourceContext<PlanningSource>('Agenda et tâches', () => {
  throw new MissingSourceError('Agenda et tâches');
});

export const PlanningSourceProvider = context.SourceProvider;
export const usePlanningSource = context.useSource;

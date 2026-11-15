'use client';

import { createSourceContext, useScreenQuery } from '../../outils/kit';
import type { ScreenQuery } from '../../outils/kit';
import { createDemoTasksSource } from './demo';
import { taskListSchema } from './schemas';
import type { Assignee } from '../shared/biens';
import type { Task, TaskInput } from './schemas';

export interface TasksSource {
  list: () => Promise<unknown>;
  create: (draft: TaskInput) => Promise<unknown>;
  update: (id: string, draft: TaskInput) => Promise<unknown>;
  setDone: (id: string, done: boolean) => Promise<unknown>;
  complete: (ids: readonly string[]) => Promise<void>;
  postponeTo: (ids: readonly string[], dueDate: string) => Promise<void>;
  assign: (ids: readonly string[], assignee: Assignee) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const context = createSourceContext(createDemoTasksSource);

export const TasksSourceProvider = context.Provider;
export const useTasksSource = context.useSource;
export const resetTasksDemo = context.resetDefault;

export const TASKS_KEY = ['suivi', 'taches'] as const;

export function useTasks(): ScreenQuery<Task[]> {
  const source = useTasksSource();
  return useScreenQuery(TASKS_KEY, source.list, taskListSchema);
}

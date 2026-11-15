import { DEMO_MONTH, DEMO_TODAY } from '../../outils/kit';
import { bienShort } from '../shared/biens';
import { diffDays, yearMonthOf } from '../shared/dates';
import { compareText } from '../shared/text';
import type { Task } from './schemas';

export type SortKey = 'title' | 'bien' | 'assignee' | 'dueDate';

export const isOverdue = (task: Task): boolean => !task.done && task.dueDate < DEMO_TODAY;
export const lateDays = (task: Task): number => diffDays(task.dueDate, DEMO_TODAY);
export const isThisWeek = (task: Task): boolean => task.dueDate >= DEMO_TODAY && diffDays(DEMO_TODAY, task.dueDate) <= 7;
export const isThisMonth = (task: Task): boolean => yearMonthOf(task.dueDate) === DEMO_MONTH;

export function compareTasks(key: SortKey, a: Task, b: Task): number {
  switch (key) {
    case 'title':
      return compareText(a.title, b.title);
    case 'bien':
      return compareText(bienShort(a.bienId), bienShort(b.bienId));
    case 'assignee':
      return compareText(a.assignee, b.assignee);
    case 'dueDate':
      return a.dueDate.localeCompare(b.dueDate);
  }
}

export const defaultOrder = (a: Task, b: Task): number => a.dueDate.localeCompare(b.dueDate);

import type { BadgeTone } from '@eguardimmo/ui';
import { TASK_STATUSES } from '../model';
import type { TaskStatus } from '../model';

export const taskStatusBadge: Record<TaskStatus, { label: string; tone: BadgeTone }> = {
  open: { label: 'Ouverte', tone: 'info' },
  done: { label: 'Terminée', tone: 'success' },
  cancelled: { label: 'Annulée', tone: 'neutral' },
};

export const STATUS_FILTERS = [
  { value: 'open', label: 'Ouvertes' },
  { value: 'all', label: 'Ouvertes et terminées' },
  { value: 'done', label: 'Terminées' },
  { value: 'cancelled', label: 'Annulées' },
] as const;

export type StatusFilter = (typeof STATUS_FILTERS)[number]['value'];

export const statusOfFilter = (filter: StatusFilter): TaskStatus | null => TASK_STATUSES.find((status) => status === filter) ?? null;

export const INACTIVE_ASSIGNEE = 'Ancien membre (inactif)';
export const UNKNOWN_ASSIGNEE = 'Autre membre';

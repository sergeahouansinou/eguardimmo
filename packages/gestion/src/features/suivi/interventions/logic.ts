import { DEMO_TODAY } from '../../outils/kit';
import { compareText } from '../shared/text';
import { bienLabel } from '../shared/biens';
import type { Intervention, InterventionStatus, Priority } from './schemas';

export type SortKey = 'subject' | 'bien' | 'dueDate' | 'updatedAt' | 'priority' | 'status';

const priorityRank: Record<Priority, number> = { urgente: 0, normale: 1, basse: 2 };
const statusRank: Record<InterventionStatus, number> = { ouverte: 0, en_cours: 1, terminee: 2 };

export const isLate = (item: Intervention): boolean =>
  item.status !== 'terminee' && item.dueDate !== null && item.dueDate < DEMO_TODAY;

const dueOf = (item: Intervention): string => item.dueDate ?? '9999-12-31';

export function compareInterventions(key: SortKey, a: Intervention, b: Intervention): number {
  switch (key) {
    case 'subject':
      return compareText(a.subject, b.subject);
    case 'bien':
      return compareText(bienLabel(a.bienId), bienLabel(b.bienId));
    case 'dueDate':
      return dueOf(a).localeCompare(dueOf(b));
    case 'updatedAt':
      return a.updatedAt.localeCompare(b.updatedAt);
    case 'priority':
      return priorityRank[a.priority] - priorityRank[b.priority];
    case 'status':
      return statusRank[a.status] - statusRank[b.status];
  }
}

export const defaultOrder = (a: Intervention, b: Intervention): number =>
  priorityRank[a.priority] - priorityRank[b.priority] || dueOf(a).localeCompare(dueOf(b));

import { DEMO_TODAY } from '../../outils/kit';
import { compareText } from '../shared/text';
import { euroInput } from '../../locataires/kit/money';
import { bienLabel } from '../shared/biens';
import { formatFrDate } from '../shared/dates';
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

export function expenseHref(item: Intervention): string {
  const params = new URLSearchParams({ bien: bienLabel(item.bienId), description: item.subject });
  if (item.intervenant) params.set('fournisseur', item.intervenant);
  if (item.quote && item.quote.status !== 'refuse') params.set('montant', euroInput(item.quote.amount));
  return `/finances/depenses/nouvelle?${params.toString()}`;
}

export function tenantMessage(item: Intervention, tenant: string): string {
  const due = item.dueDate ? ` Échéance prévue : ${formatFrDate(item.dueDate)}.` : '';
  const who = item.intervenant ? ` ${item.intervenant} interviendra.` : '';
  return `Bonjour ${tenant},\n\nUne intervention est prévue dans votre logement (${bienLabel(item.bienId)}) : ${item.subject}.${due}${who}\n\nMerci de nous indiquer vos disponibilités.\n\nCordialement,`;
}

import type { BadgeTone } from '@eguardimmo/ui';
import type { ActType, CaseStatus, ReceivableType, TransmissionState } from './model';
import { periodLabel } from '../rent/labels';

export const caseBadge: Record<CaseStatus, { label: string; tone: BadgeTone }> = {
  open: { label: 'Ouvert', tone: 'warning' },
  in_plan: { label: 'Plan de paiement', tone: 'info' },
  closed: { label: 'Clos', tone: 'success' },
  uncollectible: { label: 'Irrécouvrable', tone: 'neutral' },
};

export const actLabel: Record<ActType, string> = {
  reminder: 'Relance amiable',
  formal_notice: 'Mise en demeure',
  call: 'Appel téléphonique',
  email: 'E-mail',
  visit: 'Visite',
  payment_plan: 'Plan de paiement',
  bailiff_action: 'Acte du commissaire de justice',
  note: 'Note',
  transmission: 'Transmission des pièces',
  revocation: 'Révocation du lien',
};

export const transmissionBadge: Record<TransmissionState, { label: string; tone: BadgeTone }> = {
  active: { label: 'Lien actif', tone: 'success' },
  expired: { label: 'Lien expiré', tone: 'neutral' },
  revoked: { label: 'Lien révoqué', tone: 'danger' },
};

export const isActive = (status: CaseStatus): boolean => status === 'open' || status === 'in_plan';

export function ageTone(days: number): BadgeTone {
  if (days >= 60) return 'danger';
  if (days >= 30) return 'warning';
  return 'neutral';
}

export const daysLabel = (days: number): string => `${String(days)} ${days > 1 ? 'jours' : 'jour'}`;

export function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Ko`;
  return `${(bytes / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
}

export const safeZipName = (name: string): string => `${name.replace(/[^A-Za-z0-9._-]+/g, '-')}.zip`;

export interface ReceivableView {
  type: ReceivableType;
  reference: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

export function receivableTitle(item: ReceivableView): string {
  if (item.type === 'invoice') return `Facture ${item.reference ?? ''}`.trim();
  return item.periodStart !== null && item.periodEnd !== null ? periodLabel(item.periodStart, item.periodEnd) : '—';
}

export function receivableTarget(item: ReceivableView): string {
  if (item.type === 'invoice') return `la facture ${item.reference ?? ''}`.trim();
  return `l’échéance de ${receivableTitle(item)}`;
}

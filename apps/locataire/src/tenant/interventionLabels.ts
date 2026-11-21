import type { Tone } from '@eguardimmo/shell';
import type { InterventionVisit, ReportedUrgency, TenantIntervention, TenantState, VisitSlot, VisitStatus } from './interventionModel';

export const STATE_VIEW: Record<TenantState, { label: string; tone: Tone }> = {
  reported: { label: 'En cours d’étude', tone: 'info' },
  in_progress: { label: 'En cours', tone: 'warning' },
  done: { label: 'Terminée', tone: 'success' },
  declined: { label: 'Classée sans suite', tone: 'neutral' },
  cancelled: { label: 'Annulée', tone: 'neutral' },
};

export const SLOT_LABEL: Record<VisitSlot, string> = { morning: 'Matin', afternoon: 'Après-midi', evening: 'Fin de journée' };

export const VISIT_STATUS_VIEW: Record<VisitStatus, { label: string; tone: Tone }> = {
  proposed: { label: 'À confirmer', tone: 'warning' },
  confirmed: { label: 'Confirmé', tone: 'success' },
  reschedule_requested: { label: 'Report demandé', tone: 'info' },
  done: { label: 'Effectué', tone: 'success' },
  cancelled: { label: 'Annulé', tone: 'neutral' },
  no_show: { label: 'Absence constatée', tone: 'danger' },
};

export const URGENCY_OPTIONS: readonly { value: ReportedUrgency; label: string; detail: string }[] = [
  { value: 'urgent', label: 'Urgent', detail: 'Risque de dégât important' },
  { value: 'soon', label: 'À traiter rapidement', detail: 'Sous quelques jours' },
  { value: 'normal', label: 'Peut attendre', detail: 'Sans gêne immédiate' },
];

export const urgencyLabel = (urgency: ReportedUrgency | null): string => URGENCY_OPTIONS.find((option) => option.value === urgency)?.label ?? 'Non précisée';

const DECLINE_REASONS: Readonly<Record<string, string>> = {
  duplicate: 'Demande en double',
  out_of_scope: 'Hors du périmètre de la gestion',
  not_an_issue: 'Aucun désordre constaté',
  tenant_responsibility: 'À la charge du locataire',
  other: 'Autre motif',
};

export const declineReasonLabel = (reason: string): string => DECLINE_REASONS[reason] ?? 'Autre motif';

const ACTIVE_VISITS: readonly VisitStatus[] = ['proposed', 'confirmed', 'reschedule_requested'];

export const nextVisit = (item: Pick<TenantIntervention, 'visits'>): InterventionVisit | null =>
  [...item.visits].filter((visit) => ACTIVE_VISITS.includes(visit.status)).sort((a, b) => a.scheduledOn.localeCompare(b.scheduledOn))[0] ?? null;

export const isOpen = (state: TenantState): boolean => state === 'reported' || state === 'in_progress';

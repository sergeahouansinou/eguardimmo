import type { Tone } from '@/console/schemas';
import type { PlanVersionStatus } from '@/platform/plans/plans';

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  trialing: 'En essai',
  free: 'Gratuit',
  active: 'Actif',
  past_due: 'Paiement en retard',
  cancelling: 'Résiliation en cours',
  ended: 'Terminé',
};

export const SUBSCRIPTION_STATUS_TONES: Record<string, Tone> = {
  trialing: 'info',
  free: 'neutral',
  active: 'success',
  past_due: 'danger',
  cancelling: 'warning',
  ended: 'neutral',
};

export const VERSION_STATUS_LABELS: Record<PlanVersionStatus, string> = {
  draft: 'Brouillon',
  published: 'Publiée',
  archived: 'Archivée',
};

export const VERSION_STATUS_TONES: Record<PlanVersionStatus, Tone> = {
  draft: 'warning',
  published: 'success',
  archived: 'neutral',
};

export const GROUP_LABELS: Record<string, string> = {
  socle: 'Socle',
  gestion: 'Gestion',
  suivi: 'Suivi',
  pilotage: 'Pilotage',
};

export const GROUP_ORDER = ['socle', 'gestion', 'suivi', 'pilotage'] as const;

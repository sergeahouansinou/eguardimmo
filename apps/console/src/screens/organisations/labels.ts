import type { Tone } from '@/console/schemas';

export const KIND_LABELS: Record<string, string> = { agency: 'Agence', individual: 'Particulier' };

export const STATE_LABELS: Record<string, string> = { active: 'Active', suspended: 'Suspendue' };

export const SUBSCRIPTION_LABELS: Record<string, string> = {
  trialing: 'Essai',
  free: 'Gratuit',
  active: 'Actif',
  past_due: 'Paiement en retard',
  cancelling: 'Résiliation en cours',
  ended: 'Terminé',
};

export const SUBSCRIPTION_TONES: Record<string, Tone> = {
  trialing: 'info',
  free: 'neutral',
  active: 'success',
  past_due: 'warning',
  cancelling: 'warning',
  ended: 'neutral',
};

export const SCOPE_LABELS: Record<string, string> = { settings: 'Réglages', team: 'Équipe', records: 'Fiches', documents: 'Documents' };

export const ACCESS_STATUS_LABELS: Record<string, string> = {
  requested: 'Demandé',
  active: 'Actif',
  refused: 'Refusé',
  revoked: 'Révoqué',
  expired: 'Expiré',
};

export const ACCESS_STATUS_TONES: Record<string, Tone> = {
  requested: 'info',
  active: 'success',
  refused: 'neutral',
  revoked: 'neutral',
  expired: 'neutral',
};

export const ACCESS_KIND_LABELS: Record<string, string> = { consent: 'Consentement', emergency: 'Urgence' };

export const GROUP_LABELS: Record<string, string> = { socle: 'Socle', gestion: 'Gestion', suivi: 'Suivi', pilotage: 'Pilotage' };

export const SOURCE_LABELS: Record<string, string> = { plan: 'Plan', override: 'Dérogation' };

export const OVERRIDE_REASON_LABELS: Record<string, string> = {
  commercial_gesture: 'Geste commercial',
  migration: 'Migration',
  incident: 'Incident',
  pilot: 'Pilote',
};

export const OVERRIDE_REASONS = ['commercial_gesture', 'migration', 'incident', 'pilot'] as const;

export const ALL = 'all';

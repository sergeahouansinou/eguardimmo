import type { Tone } from '@/console/schemas';
import type { ApprovalStatus } from './approvals/approvals';

export const APPROVAL_ACTION_LABELS: Record<string, string> = {
  'organizations.suspend': 'Suspension d’une organisation',
  'organizations.reactivate': 'Réactivation d’une organisation',
  'identity.account.reactivate': 'Réactivation d’un compte',
  'identity.account.reset_two_factor': 'Réinitialisation de la double authentification',
  'subscriptions.plan_version.publish': 'Publication d’une version de plan',
  'subscriptions.override.grant': 'Dérogation de droits',
  'subscriptions.override.revoke': 'Retrait d’une dérogation',
  'privacy.erasure.execute': 'Effacement d’un compte (RGPD)',
};

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  pending: 'En attente d’un second opérateur',
  approved: 'Validée',
  rejected: 'Refusée',
  expired: 'Expirée',
  cancelled: 'Annulée',
  failed: 'Échec à l’exécution',
};

export const APPROVAL_STATUS_TONES: Record<ApprovalStatus, Tone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'neutral',
  expired: 'neutral',
  cancelled: 'neutral',
  failed: 'danger',
};

export const SUSPENSION_REASON_LABELS: Record<string, string> = {
  fraud: 'Fraude',
  abuse: 'Abus',
  legal_order: 'Ordre légal',
  security: 'Sécurité',
};

export const VERIFICATION_METHOD_LABELS: Record<string, string> = {
  known_channel: 'Canal déjà connu',
  video_call: 'Appel vidéo',
  document_seen: 'Pièce présentée (non conservée)',
  account_session: 'Session du compte',
};

export function labelOf(labels: Readonly<Record<string, string>>, key: string): string {
  return labels[key] ?? key;
}

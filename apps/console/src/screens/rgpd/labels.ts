import type { Tone } from '@/console/schemas';
import type { RequestStatus } from '@/platform/privacy/privacy';

export const KIND_LABELS: Record<string, string> = {
  access: 'Accès',
  rectification: 'Rectification',
  erasure: 'Effacement',
  portability: 'Portabilité',
  restriction: 'Limitation',
  objection: 'Opposition',
};

export const CHANNEL_LABELS: Record<string, string> = {
  account: 'Depuis le compte',
  email: 'E-mail',
  letter: 'Courrier',
};

export const STATUS_LABELS: Record<RequestStatus, string> = {
  received: 'Reçue',
  in_progress: 'En cours',
  completed: 'Traitée',
  refused: 'Refusée',
};

export const STATUS_TONES: Record<RequestStatus, Tone> = {
  received: 'info',
  in_progress: 'warning',
  completed: 'success',
  refused: 'neutral',
};

export const EXTENSION_REASON_LABELS: Record<string, string> = {
  complexity: 'Complexité de la demande',
  volume: 'Nombre de demandes',
};

export const REFUSAL_REASON_LABELS: Record<string, string> = {
  manifestly_unfounded: 'Manifestement infondée',
  excessive: 'Excessive',
  identity_unverified: 'Identité non vérifiée',
  legal_obligation: 'Obligation légale de conservation',
};

export const EVENT_LABELS: Record<string, string> = {
  received: 'Demande reçue',
  verified: 'Identité vérifiée',
  extended: 'Délai prolongé',
  forwarded: 'Transmise aux organisations',
  forward_handled: 'Transmission traitée',
  exported: 'Export généré',
  downloaded: 'Export téléchargé par le demandeur',
  export_purged: 'Export purgé',
  due_flagged: 'Échéance dépassée signalée',
  erasure_executed: 'Effacement exécuté',
  completed: 'Demande clôturée',
  refused: 'Demande refusée',
};

export const EVENT_TONES: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  completed: 'success',
  verified: 'success',
  erasure_executed: 'danger',
  refused: 'danger',
  due_flagged: 'warning',
  extended: 'warning',
};

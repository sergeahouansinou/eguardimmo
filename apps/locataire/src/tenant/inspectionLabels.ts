import type { Tone } from '@eguardimmo/shell';
import type { FailureWording } from './errors';
import { FILE_CODES } from './fileErrors';

export const INSPECTION_KIND_LABEL = { entry: 'État des lieux d’entrée', exit: 'État des lieux de sortie' } as const;

export const PERFORMER_LABEL = {
  parties: 'Réalisé entre les parties',
  agent: 'Réalisé par l’agence',
  bailiff: 'Réalisé par un commissaire de justice',
} as const;

export const REMARK_KIND_VIEW = {
  complement: { label: 'Complément à l’état d’entrée', detail: 'À demander dans les 10 jours qui suivent l’état des lieux d’entrée.' },
  heating: { label: 'Remarque sur le chauffage', detail: 'Possible pendant la première période de chauffe du bail.' },
  comment: { label: 'Commentaire sur l’état de sortie', detail: 'Possible tant que votre accès au bail reste ouvert.' },
} as const;

export const DECISION_VIEW: Record<'accepted' | 'refused' | 'noted', { label: string; tone: Tone }> = {
  accepted: { label: 'Acceptée par l’agence', tone: 'success' },
  refused: { label: 'Refusée par l’agence', tone: 'danger' },
  noted: { label: 'Prise en compte par l’agence', tone: 'info' },
};

export const INSPECTION_CODES: Readonly<Record<string, string>> = {
  ...FILE_CODES,
  inspection_not_found: 'Cet état des lieux n’existe pas ou ne vous est pas accessible.',
  inspection_remark_not_found: 'Cette remarque n’existe plus.',
  inspection_remark_window_closed: 'Ce type de remarque n’est plus possible : le délai est dépassé pour cet état des lieux.',
  inspection_remark_answered: 'Cette remarque a déjà reçu une réponse de l’agence : elle ne peut plus évoluer.',
  inspection_not_publishable: 'Cet état des lieux n’est pas encore consultable.',
  inspection_published: 'Un état des lieux publié est figé : il ne se modifie plus. Ajoutez plutôt une remarque.',
  inspection_stale_version: 'Cet état des lieux a changé entre-temps : rechargez la page.',
  idempotency_key_reused: 'Cette remarque a déjà été enregistrée avec un contenu différent. Rechargez la page pour en saisir une nouvelle.',
  validation_failed: 'Certains champs sont invalides : vérifiez votre saisie.',
};

export const INSPECTION_WORDING: FailureWording = {
  notFound: INSPECTION_CODES.inspection_not_found,
  codes: INSPECTION_CODES,
};

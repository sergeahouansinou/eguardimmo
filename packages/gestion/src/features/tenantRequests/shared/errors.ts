import { ApiError } from '@eguardimmo/api';

export type TenantRequestsErrorKind =
  | 'unauthenticated'
  | 'forbidden'
  | 'two_factor_required'
  | 'reauthentication_required'
  | 'not_found'
  | 'conflict'
  | 'stale'
  | 'invalid'
  | 'unavailable'
  | 'rate_limited'
  | 'unexpected_response'
  | 'no_organization';

export class TenantRequestsError extends Error {
  readonly kind: TenantRequestsErrorKind;
  readonly status: number | null;
  readonly code: string;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;

  constructor(kind: TenantRequestsErrorKind, message: string, options: { status?: number; code?: string; fieldErrors?: Readonly<Record<string, readonly string[]>>; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'TenantRequestsError';
    this.kind = kind;
    this.status = options.status ?? null;
    this.code = options.code ?? kind;
    this.fieldErrors = options.fieldErrors ?? {};
  }
}

export const NO_ORGANIZATION_MESSAGE = 'Aucune organisation n’est sélectionnée : les demandes des locataires ne peuvent pas être chargées.';
export const UNEXPECTED_RESPONSE_MESSAGE = 'Réponse inattendue du serveur. Réessayez dans un instant.';
export const REAUTHENTICATION_MESSAGE = 'Confirmez votre identité avec un code de double authentification de moins de 10 minutes, puis recommencez.';
export const TWO_FACTOR_MESSAGE = 'Cette action exige la double authentification. Activez-la dans Mon compte, Connexion et sécurité, puis recommencez.';
const FORBIDDEN_MESSAGE = 'Votre rôle ne permet pas cette action.';

export const unexpectedResponse = (detail?: string): TenantRequestsError =>
  new TenantRequestsError('unexpected_response', detail ? `${UNEXPECTED_RESPONSE_MESSAGE} (${detail})` : UNEXPECTED_RESPONSE_MESSAGE, { code: 'unexpected_response' });

export const invalidInput = (message: string): TenantRequestsError => new TenantRequestsError('invalid', message, { status: 422, code: 'invalid_input' });

export const CODE_MESSAGES: Readonly<Record<string, string>> = {
  notice_request_not_found: 'Cette demande de congé n’existe pas dans votre organisation, ou elle a déjà été traitée.',
  notice_request_locked: 'Cette demande a déjà reçu un accusé de réception ou a été retirée : elle ne peut plus être accusée.',
  notice_request_exists: 'Une demande de congé est déjà en cours pour ce locataire sur ce bail.',
  notice_proof_required: 'Le justificatif du motif manque : le locataire doit le joindre à sa demande.',
  notice_reason_unsupported: 'Ce motif de congé n’est pas reconnu pour ce bail.',
  notice_departure_too_early: 'La date de départ est antérieure au premier jour possible compte tenu du préavis.',
  notice_letter_unavailable: 'La lettre de congé n’est pas disponible pour le moment.',
  lease_notice_invalid: 'Les dates de ce congé sont incohérentes : la réception ne peut pas être dans le futur, ni précéder le dépôt de la demande.',
  lease_notice_exists: 'Un préavis est déjà enregistré sur ce bail. Cochez le remplacement pour l’écraser.',
  lease_notice_not_allowed: 'Ce bail n’accepte pas de congé : il n’est pas signé, il est terminé ou un préavis y est déjà enregistré.',
  lease_jurisdiction_unsupported: 'Le congé en ligne n’est pas ouvert pour la juridiction de ce bail.',
  lease_stale_version: 'Ce bail a été modifié depuis votre lecture : rechargez la page avant de recommencer.',
  lease_last_tenant: 'Ce locataire est le dernier du bail : enregistrez le congé du bail entier plutôt que le départ d’un seul locataire.',
  lease_not_found: 'Ce bail n’existe pas dans votre organisation.',
  insurance_submission_not_found: 'Ce dépôt d’attestation n’existe pas dans votre organisation.',
  insurance_submission_not_pending: 'Ce dépôt a déjà été traité : rechargez la liste pour voir son état.',
  insurance_submission_not_allowed: 'Le dépôt d’attestation n’est pas possible sur ce bail : il est terminé ou sa période de grâce est échue.',
  insurance_period_invalid: 'Les dates de couverture de l’attestation sont incohérentes.',
  insurance_reminder_too_soon: 'Une relance a déjà été envoyée pour ce bail il y a moins de 7 jours. Ce n’est pas une mise en demeure.',
  inspection_not_found: 'Cet état des lieux n’existe pas dans votre organisation.',
  inspection_remark_not_found: 'Cette remarque n’existe pas dans votre organisation.',
  inspection_remark_answered: 'Cette remarque a déjà reçu une réponse : elle ne peut plus être modifiée.',
  inspection_remark_window_closed: 'Le délai pour cette remarque est échu.',
  inspection_not_publishable: 'Cet état des lieux ne peut pas être publié : pour une sortie, indiquez d’abord s’il est conforme à l’état d’entrée.',
  inspection_published: 'Cet état des lieux est publié, donc figé. Pour le corriger, enregistrez-en un nouveau.',
  inspection_stale_version: 'Cet état des lieux a été modifié depuis votre lecture : rechargez la page avant de recommencer.',
  idempotency_key_reused: 'Cette saisie a déjà été enregistrée avec un contenu différent. Rechargez la page pour en saisir une nouvelle.',
  payment_account_not_ready: 'Le compte de paiement de l’organisation n’est pas encore prêt : terminez son ouverture chez le prestataire de paiement.',
  payment_provider_unavailable: 'Le prestataire de paiement est momentanément indisponible. Rien n’a été enregistré : réessayez dans un instant.',
  payment_installments_in_progress: 'Un paiement en plusieurs fois est déjà en cours sur cette échéance : attendez la fin des versements avant d’en lancer un autre.',
  payment_nothing_due: 'Il ne reste rien à payer sur ce bail : aucun paiement n’est à lancer.',
  lease_document_invalid: 'Ce document ne peut pas être partagé : seul un fichier téléversé pour ce bail, à destination d’un locataire de ce bail, est accepté.',
  online_payment_not_found: 'Ce paiement en ligne n’existe pas dans votre organisation.',
  contact_update_not_found: 'Cette demande de modification n’existe pas pour ce locataire.',
  contact_update_not_pending: 'Cette demande a déjà été traitée : rechargez la page pour voir son état.',
  contact_update_empty: 'Cette demande ne contient aucune coordonnée à appliquer.',
  contact_point_exists: 'Cette coordonnée existe déjà sur la fiche du locataire.',
  party_not_found: 'Cette fiche n’existe pas dans votre organisation.',
  documents_file_not_found: 'Ce fichier n’existe plus ou n’est pas disponible.',
  file_unavailable: 'Le contenu de ce fichier est momentanément indisponible.',
  validation_failed: 'Certains champs sont invalides : relisez le formulaire.',
};

const STALE_CODES: readonly string[] = ['lease_stale_version', 'inspection_stale_version'];
const SERVER_DETAIL_CODES: readonly string[] = ['lease_notice_invalid', 'inspection_not_publishable'];

const waitLabel = (seconds: number | null): string => {
  if (seconds === null || seconds < 1) return 'un peu plus tard';
  if (seconds <= 90) return `dans ${String(seconds)} seconde${seconds > 1 ? 's' : ''}`;
  return `dans ${String(Math.ceil(seconds / 60))} minutes`;
};

export function translateApiError(error: unknown): unknown {
  if (!(error instanceof ApiError)) return error;
  const common = { status: error.status, code: error.code, fieldErrors: error.fieldErrors, cause: error };
  const known = SERVER_DETAIL_CODES.includes(error.code) ? undefined : CODE_MESSAGES[error.code];
  if (error.status === 401) return new TenantRequestsError('unauthenticated', 'Votre session a expiré. Reconnectez-vous.', common);
  if (error.status === 403) {
    if (error.code === 'two_factor_required') return new TenantRequestsError('two_factor_required', TWO_FACTOR_MESSAGE, common);
    if (error.code === 'reauthentication_required') return new TenantRequestsError('reauthentication_required', REAUTHENTICATION_MESSAGE, common);
    return new TenantRequestsError('forbidden', known ?? FORBIDDEN_MESSAGE, common);
  }
  if (error.status === 404) return new TenantRequestsError('not_found', known ?? error.message, common);
  if (error.status === 409) return new TenantRequestsError(STALE_CODES.includes(error.code) ? 'stale' : 'conflict', known ?? error.message, common);
  if (error.status === 422) return new TenantRequestsError('invalid', (error.code === 'validation_failed' ? error.firstFieldError() : null) ?? known ?? error.firstFieldError() ?? error.message, common);
  if (error.status === 429) return new TenantRequestsError('rate_limited', known ?? `Trop de requêtes en peu de temps. Aucune modification n’a été enregistrée : réessayez ${waitLabel(error.retryAfterSeconds)}.`, common);
  if (error.status === 503) return new TenantRequestsError('unavailable', known ?? 'Le service est momentanément indisponible. Rien n’a été enregistré : réessayez dans un instant.', common);
  return error;
}

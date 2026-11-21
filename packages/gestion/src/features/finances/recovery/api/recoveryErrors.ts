import { ApiError } from '@eguardimmo/api';

export type RecoveryApiErrorKind =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'invalid'
  | 'unavailable'
  | 'rate_limited'
  | 'unexpected_response'
  | 'no_organization'
  | 'unsupported';

export class RecoveryApiError extends Error {
  readonly kind: RecoveryApiErrorKind;
  readonly status: number | null;
  readonly code: string;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;

  constructor(kind: RecoveryApiErrorKind, message: string, options: { status?: number; code?: string; fieldErrors?: Readonly<Record<string, readonly string[]>>; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'RecoveryApiError';
    this.kind = kind;
    this.status = options.status ?? null;
    this.code = options.code ?? kind;
    this.fieldErrors = options.fieldErrors ?? {};
  }
}

export const NO_ORGANIZATION_MESSAGE = 'Aucune organisation n’est sélectionnée : le recouvrement ne peut pas être chargé.';
export const UNEXPECTED_RESPONSE_MESSAGE = 'Réponse inattendue du serveur. Réessayez dans un instant.';

export const unexpectedResponse = (detail?: string): RecoveryApiError =>
  new RecoveryApiError('unexpected_response', detail ? `${UNEXPECTED_RESPONSE_MESSAGE} (${detail})` : UNEXPECTED_RESPONSE_MESSAGE, { code: 'unexpected_response' });

export const unsupported = (message: string): RecoveryApiError => new RecoveryApiError('unsupported', message, { code: 'unsupported' });

export const invalidInput = (message: string): RecoveryApiError => new RecoveryApiError('invalid', message, { status: 422, code: 'invalid_input' });

const CODE_MESSAGES: Readonly<Record<string, string>> = {
  recovery_case_not_found: 'Ce dossier de recouvrement n’existe pas dans votre organisation.',
  recovery_item_not_found: 'Cette créance n’est pas dans ce dossier.',
  recovery_bundle_not_found: 'Cet envoi de pièces n’existe pas dans votre organisation.',
  recovery_transmission_not_found: 'Cette transmission n’existe pas dans votre organisation.',
  recovery_receivable_invalid: 'Cette créance n’est pas un impayé échu de ce bail.',
  recovery_receivable_taken: 'Une des créances choisies est déjà dans un dossier de recouvrement ouvert.',
  recovery_debtor_invalid: 'Le débiteur doit être un locataire de ce bail.',
  recovery_case_exists: 'Un dossier est déjà ouvert pour ce bail et ce locataire : ajoutez-y les créances au lieu d’en ouvrir un second.',
  recovery_case_not_active: 'Ce dossier est clos ou irrécouvrable : il n’accepte plus de modification.',
  recovery_case_empty: 'Le dossier ne contient aucune créance : ajoutez-en avant de générer un envoi.',
  recovery_nothing_due: 'Toutes les créances de ce dossier sont soldées : il n’y a plus rien à transmettre.',
  recovery_status_transition_invalid: 'Ce changement de statut n’est pas permis depuis le statut actuel du dossier.',
  recovery_recipient_invalid: 'Le destinataire doit être un commissaire de justice de votre organisation, actif et doté d’une adresse e-mail.',
  recovery_transmission_not_active: 'Cette transmission est déjà révoquée.',
  recovery_link_unavailable: 'L’adresse des liens de transmission n’est pas configurée côté serveur : contactez l’administrateur de la plateforme.',
  recovery_bundle_unavailable: 'Le contenu de cet envoi n’est plus disponible.',
};

const FIELD_MESSAGES: Readonly<Record<string, string>> = {
  installment_ids: 'Choisissez au moins une créance (100 échéances et 100 factures au plus).',
  invoice_ids: 'Choisissez au moins une créance (100 échéances et 100 factures au plus).',
  lease_id: 'Choisissez un bail.',
  debtor_party_id: 'Le locataire débiteur est invalide.',
  status: 'Le statut choisi est invalide.',
  reason: 'Le motif ne peut pas dépasser 255 caractères.',
  type: 'Le type d’acte est invalide.',
  performed_on: 'La date de l’acte est invalide : elle ne peut pas être dans le futur.',
  note: 'La note est trop longue (500 caractères au plus).',
  reference: 'La référence est trop longue (120 caractères au plus).',
  recipient_party_id: 'Choisissez le commissaire de justice destinataire.',
  valid_days: 'La durée de validité doit être comprise entre 1 et 30 jours.',
  cursor: 'La page demandée n’existe plus : revenez à la première page.',
  after: 'La page demandée n’existe plus : revenez à la première page.',
};

const firstFieldMessage = (error: ApiError): string => {
  const field = Object.keys(error.fieldErrors)[0];
  return (field !== undefined ? FIELD_MESSAGES[field] : undefined) ?? error.firstFieldError() ?? error.message;
};

const pdfRetryMessage = (seconds: number | null): string =>
  seconds === null
    ? 'Le service de génération des PDF est momentanément indisponible. Rien n’a été enregistré : réessayez dans un instant.'
    : `Le service de génération des PDF est momentanément indisponible. Rien n’a été enregistré : réessayez dans ${String(seconds)} secondes.`;

export function translateApiError(error: unknown): unknown {
  if (!(error instanceof ApiError)) return error;
  const common = { status: error.status, code: error.code, fieldErrors: error.fieldErrors, cause: error };
  const known = CODE_MESSAGES[error.code];
  if (error.status === 401) return new RecoveryApiError('unauthenticated', 'Votre session a expiré. Reconnectez-vous.', common);
  if (error.status === 403) return new RecoveryApiError('forbidden', 'Votre rôle ne permet pas cette action sur le recouvrement.', common);
  if (error.status === 404) return new RecoveryApiError('not_found', known ?? error.message, common);
  if (error.status === 409) return new RecoveryApiError('conflict', known ?? error.message, common);
  if (error.status === 422) return new RecoveryApiError('invalid', known ?? firstFieldMessage(error), common);
  if (error.status === 429) return new RecoveryApiError('rate_limited', 'Trop de requêtes en peu de temps. Patientez quelques secondes puis réessayez.', common);
  if (error.status === 503) {
    if (error.code === 'recovery_pdf_unavailable') return new RecoveryApiError('unavailable', pdfRetryMessage(error.retryAfterSeconds), common);
    return new RecoveryApiError('unavailable', known ?? error.message, common);
  }
  return error;
}

import { ApiError } from '@eguardimmo/api';

export type RentApiErrorKind =
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

export class RentApiError extends Error {
  readonly kind: RentApiErrorKind;
  readonly status: number | null;
  readonly code: string;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;

  constructor(kind: RentApiErrorKind, message: string, options: { status?: number; code?: string; fieldErrors?: Readonly<Record<string, readonly string[]>>; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'RentApiError';
    this.kind = kind;
    this.status = options.status ?? null;
    this.code = options.code ?? kind;
    this.fieldErrors = options.fieldErrors ?? {};
  }
}

export const NO_ORGANIZATION_MESSAGE = 'Aucune organisation n’est sélectionnée : les loyers ne peuvent pas être chargés.';
export const UNEXPECTED_RESPONSE_MESSAGE = 'Réponse inattendue du serveur. Réessayez dans un instant.';

export const unexpectedResponse = (detail?: string): RentApiError =>
  new RentApiError('unexpected_response', detail ? `${UNEXPECTED_RESPONSE_MESSAGE} (${detail})` : UNEXPECTED_RESPONSE_MESSAGE, { code: 'unexpected_response' });

export const unsupported = (message: string): RentApiError => new RentApiError('unsupported', message, { code: 'unsupported' });

export const invalidInput = (message: string): RentApiError => new RentApiError('invalid', message, { status: 422, code: 'invalid_input' });

const CODE_MESSAGES: Readonly<Record<string, string>> = {
  rent_installment_not_found: 'Cette échéance n’existe pas dans votre organisation.',
  rent_payment_not_found: 'Ce paiement n’existe pas dans votre organisation.',
  rent_receipt_not_found: 'Cette quittance n’existe pas dans votre organisation.',
  rent_notice_not_found: 'Aucun avis d’échéance n’a encore été émis pour cette échéance.',
  rent_lease_not_billable: 'Ce bail ne peut pas être facturé : il doit être signé, avec un lot, un locataire et un loyer.',
  rent_installment_not_issuable: 'Cet avis d’échéance ne peut pas être émis dans l’état actuel de l’échéance.',
  rent_installment_has_payments: 'Cette échéance a reçu des encaissements : annulez-les avant d’annuler l’échéance.',
  rent_installment_not_paid: 'Une quittance ne s’émet que pour une échéance entièrement soldée.',
  rent_payment_invalid: 'Ce paiement ne peut pas être enregistré ou annulé dans l’état actuel du bail.',
  rent_idempotency_key_reused: 'Cet encaissement a déjà été saisi avec un contenu différent. Rechargez le formulaire pour en saisir un nouveau.',
  rent_component_unclassified: 'Une composante du loyer n’a pas de sens comptable défini : les échéances ne peuvent pas être générées.',
  rent_issuer_unknown: 'L’émetteur du document est introuvable pour votre compte.',
  rent_jurisdiction_unsupported: 'La juridiction de ce bail n’est pas encore prise en charge pour les avis et quittances.',
};

const FIELD_MESSAGES: Readonly<Record<string, string>> = {
  lease_id: 'Choisissez un bail.',
  amount: 'Le montant est invalide : indiquez un montant strictement positif.',
  method: 'Le mode de règlement est invalide.',
  received_on: 'La date de réception est invalide : elle ne peut pas être dans le futur.',
  reference: 'La référence est trop longue (120 caractères au plus).',
  note: 'La note est trop longue (500 caractères au plus).',
  idempotency_key: 'La clé de saisie est invalide : rechargez le formulaire.',
  reason: 'Le motif doit contenir entre 2 et 255 caractères.',
  limit: 'Le nombre d’éléments demandé est invalide.',
  cursor: 'La page demandée n’existe plus : revenez à la première page.',
  due_from: 'La date de début est invalide.',
  due_to: 'La date de fin est invalide ou antérieure à la date de début.',
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
  if (error.status === 401) return new RentApiError('unauthenticated', 'Votre session a expiré. Reconnectez-vous.', common);
  if (error.status === 403) return new RentApiError('forbidden', 'Votre rôle ne permet pas cette action sur les loyers.', common);
  if (error.status === 404) return new RentApiError('not_found', known ?? error.message, common);
  if (error.status === 409) return new RentApiError('conflict', known ?? error.message, common);
  if (error.status === 422) return new RentApiError('invalid', firstFieldMessage(error), common);
  if (error.status === 429) return new RentApiError('rate_limited', 'Trop de requêtes en peu de temps. Patientez quelques secondes puis réessayez.', common);
  if (error.status === 503) return new RentApiError('unavailable', error.code === 'rent_pdf_unavailable' ? pdfRetryMessage(error.retryAfterSeconds) : error.message, common);
  return error;
}

import { ApiError } from '@eguardimmo/api';

export type ConformiteApiErrorKind =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'invalid'
  | 'too_large'
  | 'unsupported_media'
  | 'unavailable'
  | 'rate_limited'
  | 'unexpected_response'
  | 'no_organization'
  | 'client_refused';

export class ConformiteApiError extends Error {
  readonly kind: ConformiteApiErrorKind;
  readonly status: number | null;
  readonly code: string;
  readonly fieldMessages: Readonly<Record<string, string>>;

  constructor(kind: ConformiteApiErrorKind, message: string, options: { status?: number; code?: string; fieldMessages?: Readonly<Record<string, string>>; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'ConformiteApiError';
    this.kind = kind;
    this.status = options.status ?? null;
    this.code = options.code ?? kind;
    this.fieldMessages = options.fieldMessages ?? {};
  }
}

export const NO_ORGANIZATION_MESSAGE = 'Aucune organisation n’est sélectionnée : la conformité ne peut pas être chargée.';
export const UNEXPECTED_RESPONSE_MESSAGE = 'Réponse inattendue du serveur. Réessayez dans un instant.';
export const FILE_TOO_LARGE_MESSAGE = 'Ce fichier dépasse la taille maximale autorisée (10 Mo).';
export const FILE_TYPE_MESSAGE = 'Ce type de fichier n’est pas accepté (PDF, JPEG, PNG ou WebP).';

export const unexpectedResponse = (detail?: string): ConformiteApiError =>
  new ConformiteApiError('unexpected_response', detail ? `${UNEXPECTED_RESPONSE_MESSAGE} (${detail})` : UNEXPECTED_RESPONSE_MESSAGE, { code: 'unexpected_response' });

export const clientRefused = (field: string, message: string): ConformiteApiError =>
  new ConformiteApiError('client_refused', message, { status: 422, code: 'client_refused', fieldMessages: { [field]: message } });

const CODE_MESSAGES: Readonly<Record<string, string>> = {
  certificate_not_found: 'Cette pièce n’existe pas dans votre organisation.',
  file_not_found: 'Ce fichier n’existe pas dans votre organisation.',
  subject_not_found: 'L’objet choisi n’existe pas dans votre organisation ou ne peut pas porter de pièce.',
  term_not_found: 'Ce type de pièce n’est pas disponible pour votre organisation.',
  party_not_found: 'L’émetteur choisi n’existe pas dans votre organisation.',
  certificate_already_replaced: 'Cette pièce a déjà été renouvelée : renouvelez la pièce la plus récente.',
  certificate_schema_invalid: 'Le schéma de données de ce type de pièce est invalide : contactez un administrateur.',
  retention_active: 'Ce fichier est conservé jusqu’à la fin de sa durée de conservation.',
  file_unavailable: 'Le contenu de ce fichier est introuvable ; l’incident est signalé.',
};

const FIELD_MESSAGES: Readonly<Record<string, string>> = {
  subject_type: 'L’objet concerné est invalide.',
  subject_id: 'Choisissez l’objet concerné.',
  certificate_type_term_id: 'Choisissez le type de pièce.',
  reference: 'La référence est trop longue (120 caractères au plus).',
  issued_on: 'La date d’émission est invalide : indiquez une date au format AAAA-MM-JJ.',
  expires_on: 'La date d’échéance est invalide ou antérieure à la date d’émission.',
  stored_file_id: 'Le fichier joint est introuvable.',
  state: 'L’état demandé est invalide.',
  cursor: 'La page demandée n’existe plus : revenez à la première page.',
  per_page: 'Le nombre d’éléments demandé est invalide.',
  energy_class: 'La classe énergétique est invalide.',
  ghg_class: 'La classe climat est invalide.',
  guaranteed_amount: 'Le montant garanti est invalide : indiquez un entier positif.',
};

const isTranslationKey = (message: string): boolean => /^validation\.[\w.]+$/.test(message);

const fieldKeyOf = (field: string): string => (field.startsWith('values.') ? field.slice('values.'.length) : field);

function translateField(field: string, messages: readonly string[]): string {
  if (field === 'file') return messages.find((message) => !isTranslationKey(message)) ?? 'Ce fichier est refusé.';
  return FIELD_MESSAGES[fieldKeyOf(field)] ?? messages.find((message) => !isTranslationKey(message)) ?? 'Cette valeur est invalide.';
}

export function translateFields(fieldErrors: Readonly<Record<string, readonly string[]>>): Record<string, string> {
  return Object.fromEntries(Object.entries(fieldErrors).map(([field, messages]) => [field, translateField(field, messages)]));
}

const retryMessage = (seconds: number | null): string =>
  seconds === null ? 'Trop de requêtes en peu de temps. Patientez quelques secondes puis réessayez.' : `Trop de requêtes en peu de temps. Réessayez dans ${String(seconds)} secondes.`;

export function translateApiError(error: unknown): unknown {
  if (!(error instanceof ApiError)) return error;
  const fieldMessages = translateFields(error.fieldErrors);
  const common = { status: error.status, code: error.code, fieldMessages, cause: error };
  const known = CODE_MESSAGES[error.code];
  if (error.status === 401) return new ConformiteApiError('unauthenticated', 'Votre session a expiré. Reconnectez-vous.', common);
  if (error.status === 403) return new ConformiteApiError('forbidden', 'Votre rôle ne permet pas cette action sur la conformité.', common);
  if (error.status === 404) return new ConformiteApiError('not_found', known ?? error.message, common);
  if (error.status === 409) return new ConformiteApiError('conflict', known ?? error.message, common);
  if (error.status === 413) return new ConformiteApiError('too_large', FILE_TOO_LARGE_MESSAGE, { ...common, fieldMessages: { file: FILE_TOO_LARGE_MESSAGE } });
  if (error.status === 415) return new ConformiteApiError('unsupported_media', FILE_TYPE_MESSAGE, { ...common, fieldMessages: { file: FILE_TYPE_MESSAGE } });
  if (error.status === 422) {
    const first = Object.values(fieldMessages)[0];
    return new ConformiteApiError('invalid', known ?? first ?? error.message, common);
  }
  if (error.status === 429) return new ConformiteApiError('rate_limited', retryMessage(error.retryAfterSeconds), common);
  if (error.status === 503) return new ConformiteApiError('unavailable', known ?? error.message, common);
  if (error.status === 500 && known !== undefined) return new ConformiteApiError('unavailable', known, common);
  return error;
}

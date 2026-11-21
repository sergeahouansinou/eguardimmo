import { ApiError } from '@eguardimmo/api';

export type LocatairesApiErrorKind =
  | 'unauthenticated'
  | 'forbidden'
  | 'two_factor_required'
  | 'reauthentication_required'
  | 'not_found'
  | 'stale_version'
  | 'conflict'
  | 'payout_request_required'
  | 'invalid'
  | 'rate_limited'
  | 'unavailable'
  | 'unexpected_response'
  | 'no_organization'
  | 'unsupported';

export class LocatairesApiError extends Error {
  readonly kind: LocatairesApiErrorKind;
  readonly status: number | null;
  readonly code: string;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;

  constructor(kind: LocatairesApiErrorKind, message: string, options: { status?: number; code?: string; fieldErrors?: Readonly<Record<string, readonly string[]>>; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'LocatairesApiError';
    this.kind = kind;
    this.status = options.status ?? null;
    this.code = options.code ?? kind;
    this.fieldErrors = options.fieldErrors ?? {};
  }
}

export const STALE_VERSION_MESSAGE = 'Cette fiche a été modifiée entre-temps. Rechargez la page pour voir sa dernière version, puis refaites vos changements.';
export const VERSION_CONFLICT_CODE = 'party_version_conflict';

export class TenantStaleVersionError extends LocatairesApiError {
  constructor(cause?: unknown) {
    super('stale_version', STALE_VERSION_MESSAGE, { status: 409, code: VERSION_CONFLICT_CODE, cause });
    this.name = 'TenantStaleVersionError';
  }
}

export const isTenantStaleVersion = (error: unknown): error is TenantStaleVersionError => error instanceof TenantStaleVersionError;

export const TWO_FACTOR_MESSAGE = 'Cette action exige la double authentification. Activez-la dans Mon compte, Connexion et sécurité, puis recommencez.';
export const REAUTHENTICATION_MESSAGE = 'Confirmez votre identité avec un code de double authentification de moins de 10 minutes, puis recommencez.';
export const PAYOUT_REQUEST_MESSAGE = 'Ce mandant change son compte de paiement depuis son espace propriétaire. Validez sa demande dans l’écran des demandes de changement d’IBAN.';
export const PAYOUT_REQUEST_CODE = 'owner_access_requires_payout_request';

const waitLabel = (seconds: number | null): string => {
  if (seconds === null || seconds < 1) return 'un peu plus tard';
  if (seconds <= 90) return `dans ${String(seconds)} seconde${seconds > 1 ? 's' : ''}`;
  return `dans ${String(Math.ceil(seconds / 60))} minutes`;
};

export const NO_ORGANIZATION_MESSAGE = 'Aucune organisation n’est sélectionnée : les locataires ne peuvent pas être chargés.';
export const UNEXPECTED_RESPONSE_MESSAGE = 'Réponse inattendue du serveur. Réessayez dans un instant.';

export const unexpectedResponse = (detail?: string): LocatairesApiError =>
  new LocatairesApiError('unexpected_response', detail ? `${UNEXPECTED_RESPONSE_MESSAGE} (${detail})` : UNEXPECTED_RESPONSE_MESSAGE, { code: 'unexpected_response' });

export const unsupported = (message: string): LocatairesApiError => new LocatairesApiError('unsupported', message, { code: 'unsupported' });

export const invalid = (message: string, field?: string): LocatairesApiError =>
  new LocatairesApiError('invalid', message, { status: 422, code: 'invalid_input', fieldErrors: field === undefined ? {} : { [field]: [message] } });

export function translateApiError(error: unknown): unknown {
  if (!(error instanceof ApiError)) return error;
  const common = { status: error.status, code: error.code, fieldErrors: error.fieldErrors, cause: error };
  if (error.status === 401) return new LocatairesApiError('unauthenticated', 'Votre session a expiré. Reconnectez-vous.', common);
  if (error.status === 403) {
    if (error.code === 'two_factor_required') return new LocatairesApiError('two_factor_required', TWO_FACTOR_MESSAGE, common);
    if (error.code === 'reauthentication_required') return new LocatairesApiError('reauthentication_required', REAUTHENTICATION_MESSAGE, common);
    return new LocatairesApiError('forbidden', 'Vous n’avez pas le droit d’effectuer cette action sur les locataires.', common);
  }
  if (error.status === 404) return new LocatairesApiError('not_found', error.message, common);
  if (error.status === 409) {
    if (error.code === VERSION_CONFLICT_CODE) return new TenantStaleVersionError(error);
    if (error.code === PAYOUT_REQUEST_CODE) return new LocatairesApiError('payout_request_required', PAYOUT_REQUEST_MESSAGE, common);
    return new LocatairesApiError('conflict', error.message, common);
  }
  if (error.status === 422) return new LocatairesApiError('invalid', error.firstFieldError() ?? error.message, common);
  if (error.status === 429) return new LocatairesApiError('rate_limited', `Trop de requêtes en peu de temps. Aucune modification n’a été enregistrée : réessayez ${waitLabel(error.retryAfterSeconds)}.`, common);
  if (error.status === 503) return new LocatairesApiError('unavailable', 'Le service est momentanément indisponible. Rien n’a été enregistré : réessayez dans un instant.', common);
  return error;
}

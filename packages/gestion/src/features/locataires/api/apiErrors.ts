import { ApiError } from '@eguardimmo/api';

export type LocatairesApiErrorKind =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'stale_version'
  | 'conflict'
  | 'invalid'
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
  if (error.status === 403) return new LocatairesApiError('forbidden', 'Vous n’avez pas le droit d’effectuer cette action sur les locataires.', common);
  if (error.status === 404) return new LocatairesApiError('not_found', error.message, common);
  if (error.status === 409) return error.code === VERSION_CONFLICT_CODE ? new TenantStaleVersionError(error) : new LocatairesApiError('conflict', error.message, common);
  if (error.status === 422) return new LocatairesApiError('invalid', error.firstFieldError() ?? error.message, common);
  return error;
}

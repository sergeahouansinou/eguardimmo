import { ApiError } from '@eguardimmo/api';

export type BauxApiErrorKind =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'stale_version'
  | 'conflict'
  | 'invalid'
  | 'unexpected_response'
  | 'no_organization'
  | 'unsupported';

export class BauxApiError extends Error {
  readonly kind: BauxApiErrorKind;
  readonly status: number | null;
  readonly code: string;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;

  constructor(kind: BauxApiErrorKind, message: string, options: { status?: number; code?: string; fieldErrors?: Readonly<Record<string, readonly string[]>>; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'BauxApiError';
    this.kind = kind;
    this.status = options.status ?? null;
    this.code = options.code ?? kind;
    this.fieldErrors = options.fieldErrors ?? {};
  }
}

export const STALE_VERSION_MESSAGE = 'Ce bail a été modifié entre-temps. Rechargez la page pour voir sa dernière version, puis refaites vos changements.';

export class LeaseStaleVersionError extends BauxApiError {
  constructor(cause?: unknown) {
    super('stale_version', STALE_VERSION_MESSAGE, { status: 409, code: 'lease_stale_version', cause });
    this.name = 'LeaseStaleVersionError';
  }
}

export const isLeaseStaleVersion = (error: unknown): error is LeaseStaleVersionError => error instanceof LeaseStaleVersionError;

export const NO_ORGANIZATION_MESSAGE = 'Aucune organisation n’est sélectionnée : les baux ne peuvent pas être chargés.';
export const UNEXPECTED_RESPONSE_MESSAGE = 'Réponse inattendue du serveur. Réessayez dans un instant.';

export const unexpectedResponse = (detail?: string): BauxApiError =>
  new BauxApiError('unexpected_response', detail ? `${UNEXPECTED_RESPONSE_MESSAGE} (${detail})` : UNEXPECTED_RESPONSE_MESSAGE, { code: 'unexpected_response' });

export const unsupported = (message: string): BauxApiError => new BauxApiError('unsupported', message, { code: 'unsupported' });

export function translateApiError(error: unknown): unknown {
  if (!(error instanceof ApiError)) return error;
  const common = { status: error.status, code: error.code, fieldErrors: error.fieldErrors, cause: error };
  if (error.status === 401) return new BauxApiError('unauthenticated', 'Votre session a expiré. Reconnectez-vous.', common);
  if (error.status === 403) return new BauxApiError('forbidden', 'Vous n’avez pas le droit d’effectuer cette action sur les baux.', common);
  if (error.status === 404) return new BauxApiError('not_found', error.message, common);
  if (error.status === 409) return error.code === 'lease_stale_version' ? new LeaseStaleVersionError(error) : new BauxApiError('conflict', error.message, common);
  if (error.status === 422) return new BauxApiError('invalid', error.firstFieldError() ?? error.message, common);
  return error;
}

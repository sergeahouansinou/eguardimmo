import { ApiError } from '@eguardimmo/api';
import { planLimitMessage } from './planLimit';

export type OrgApiErrorKind =
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

export interface OrgApiErrorOptions {
  status?: number;
  code?: string;
  fieldErrors?: Readonly<Record<string, readonly string[]>>;
  extensions?: Readonly<Record<string, unknown>>;
  cause?: unknown;
}

export class OrgApiError extends Error {
  readonly kind: OrgApiErrorKind;
  readonly status: number | null;
  readonly code: string;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
  readonly extensions: Readonly<Record<string, unknown>>;

  constructor(kind: OrgApiErrorKind, message: string, options: OrgApiErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = 'OrgApiError';
    this.kind = kind;
    this.status = options.status ?? null;
    this.code = options.code ?? kind;
    this.fieldErrors = options.fieldErrors ?? {};
    this.extensions = options.extensions ?? {};
  }
}

export const NO_ORGANIZATION_MESSAGE = 'Aucune organisation n’est sélectionnée : cet écran ne peut pas être chargé.';
export const UNEXPECTED_RESPONSE_MESSAGE = 'Réponse inattendue du serveur. Réessayez dans un instant.';
export const REAUTHENTICATION_MESSAGE = 'Confirmez votre identité avec un code de double authentification de moins de 10 minutes, puis recommencez.';
export const TWO_FACTOR_MESSAGE = 'Cette action exige la double authentification. Activez-la dans Mon compte, Connexion et sécurité, puis recommencez.';
export const ROLE_FORBIDDEN_MESSAGE = 'Votre rôle ne permet pas cette action.';

export const unexpectedResponse = (detail?: string): OrgApiError =>
  new OrgApiError('unexpected_response', detail ? `${UNEXPECTED_RESPONSE_MESSAGE} (${detail})` : UNEXPECTED_RESPONSE_MESSAGE, { code: 'unexpected_response' });

export const invalidInput = (message: string): OrgApiError => new OrgApiError('invalid', message, { status: 422, code: 'invalid_input' });

const COMMON_MESSAGES: Readonly<Record<string, string>> = {
  role_forbidden: ROLE_FORBIDDEN_MESSAGE,
  organization_not_found: 'Cette organisation n’existe pas ou vous n’en êtes plus membre.',
  operator_token_forbidden: 'Un jeton d’opérateur ne peut pas agir dans l’espace d’une organisation.',
  validation_failed: 'Certains champs sont invalides : relisez le formulaire.',
  idempotency_key_reused: 'Cette saisie a déjà été enregistrée avec un contenu différent. Rechargez la page pour en saisir une nouvelle.',
};

export interface ErrorCatalog {
  messages: Readonly<Record<string, string>>;
  staleCodes?: readonly string[];
  serverDetailCodes?: readonly string[];
  unavailableMessage?: string;
}

export const waitLabel = (seconds: number | null): string => {
  if (seconds === null || seconds < 1) return 'un peu plus tard';
  if (seconds <= 90) return `dans ${String(seconds)} seconde${seconds > 1 ? 's' : ''}`;
  return `dans ${String(Math.ceil(seconds / 60))} minutes`;
};

export function createErrorTranslator(catalog: ErrorCatalog): (error: unknown) => unknown {
  const messages = { ...COMMON_MESSAGES, ...catalog.messages };
  const stale = catalog.staleCodes ?? [];
  const serverDetail = catalog.serverDetailCodes ?? [];
  return (error) => {
    if (!(error instanceof ApiError)) return error;
    const common = { status: error.status, code: error.code, fieldErrors: error.fieldErrors, extensions: error.extensions, cause: error };
    const known = planLimitMessage(error) ?? (serverDetail.includes(error.code) ? undefined : messages[error.code]);
    if (error.status === 401) return new OrgApiError('unauthenticated', 'Votre session a expiré. Reconnectez-vous.', common);
    if (error.status === 403) {
      if (error.code === 'two_factor_required') return new OrgApiError('two_factor_required', TWO_FACTOR_MESSAGE, common);
      if (error.code === 'reauthentication_required') return new OrgApiError('reauthentication_required', REAUTHENTICATION_MESSAGE, common);
      return new OrgApiError('forbidden', known ?? ROLE_FORBIDDEN_MESSAGE, common);
    }
    if (error.status === 404) return new OrgApiError('not_found', known ?? error.message, common);
    if (error.status === 409) return new OrgApiError(stale.includes(error.code) ? 'stale' : 'conflict', known ?? error.message, common);
    if (error.status === 422) return new OrgApiError('invalid', (error.code === 'validation_failed' ? error.firstFieldError() : null) ?? known ?? error.firstFieldError() ?? error.message, common);
    if (error.status === 429) return new OrgApiError('rate_limited', `Trop de requêtes en peu de temps. Aucune modification n’a été enregistrée : réessayez ${waitLabel(error.retryAfterSeconds)}.`, common);
    if (error.status === 503) return new OrgApiError('unavailable', known ?? catalog.unavailableMessage ?? 'Le service est momentanément indisponible. Rien n’a été enregistré : réessayez dans un instant.', common);
    return error;
  };
}

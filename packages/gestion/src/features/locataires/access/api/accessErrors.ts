import { ApiError } from '@eguardimmo/api';

export type TenantAccessApiErrorKind = 'unauthenticated' | 'forbidden' | 'not_found' | 'conflict' | 'invalid' | 'unavailable' | 'rate_limited' | 'unexpected_response' | 'no_organization';

export class TenantAccessApiError extends Error {
  readonly kind: TenantAccessApiErrorKind;
  readonly status: number | null;
  readonly code: string;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;

  constructor(kind: TenantAccessApiErrorKind, message: string, options: { status?: number; code?: string; fieldErrors?: Readonly<Record<string, readonly string[]>>; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'TenantAccessApiError';
    this.kind = kind;
    this.status = options.status ?? null;
    this.code = options.code ?? kind;
    this.fieldErrors = options.fieldErrors ?? {};
  }
}

export const NO_ORGANIZATION_MESSAGE = 'Aucune organisation n’est sélectionnée : les invitations ne peuvent pas être chargées.';
export const UNEXPECTED_RESPONSE_MESSAGE = 'Réponse inattendue du serveur. Réessayez dans un instant.';

export const unexpectedResponse = (detail?: string): TenantAccessApiError =>
  new TenantAccessApiError('unexpected_response', detail ? `${UNEXPECTED_RESPONSE_MESSAGE} (${detail})` : UNEXPECTED_RESPONSE_MESSAGE, { code: 'unexpected_response' });

const CODE_MESSAGES: Readonly<Record<string, string>> = {
  party_not_found: 'Ce contact n’existe pas dans votre organisation.',
  party_anonymized: 'Ce contact est anonymisé : il ne peut plus être invité.',
  tenant_access_person_required: 'Seule une personne physique peut être invitée à l’espace locataire.',
  tenant_access_email_required: 'Ce contact n’a pas d’e-mail principal : indiquez l’adresse à inviter.',
  tenant_access_party_archived: 'Ce contact est archivé : restaurez-le avant de l’inviter.',
  party_already_linked: 'Ce contact est déjà rattaché à un compte : révoquez son accès avant d’en inviter un autre.',
  tenant_account_already_linked: 'Ce compte est déjà rattaché à un autre contact de votre organisation.',
  tenant_access_not_found: 'Ce contact n’a ni invitation ni accès à révoquer.',
};

const FIELD_MESSAGES: Readonly<Record<string, string>> = {
  email: 'L’adresse e-mail est invalide (254 caractères au plus).',
  q: 'La recherche est trop longue (100 caractères au plus).',
};

const firstFieldMessage = (error: ApiError): string => {
  const field = Object.keys(error.fieldErrors)[0];
  return (field !== undefined ? FIELD_MESSAGES[field] : undefined) ?? error.firstFieldError() ?? error.message;
};

const waitLabel = (seconds: number | null): string => {
  if (seconds === null || seconds < 1) return 'un peu plus tard';
  if (seconds <= 90) return `dans ${String(seconds)} seconde${seconds > 1 ? 's' : ''}`;
  return `dans ${String(Math.ceil(seconds / 60))} minutes`;
};

export function translateApiError(error: unknown): unknown {
  if (!(error instanceof ApiError)) return error;
  const common = { status: error.status, code: error.code, fieldErrors: error.fieldErrors, cause: error };
  const known = CODE_MESSAGES[error.code];
  if (error.status === 401) return new TenantAccessApiError('unauthenticated', 'Votre session a expiré. Reconnectez-vous.', common);
  if (error.status === 403) return new TenantAccessApiError('forbidden', 'Votre rôle ne permet pas de gérer les invitations des locataires.', common);
  if (error.status === 404) return new TenantAccessApiError('not_found', known ?? error.message, common);
  if (error.status === 409) return new TenantAccessApiError('conflict', known ?? error.message, common);
  if (error.status === 422) return new TenantAccessApiError('invalid', known ?? firstFieldMessage(error), common);
  if (error.status === 429) return new TenantAccessApiError('rate_limited', `Trop de requêtes en peu de temps. Aucune modification n’a été enregistrée : réessayez ${waitLabel(error.retryAfterSeconds)}.`, common);
  if (error.status === 503) return new TenantAccessApiError('unavailable', 'Le service d’invitation est momentanément indisponible. Rien n’a été enregistré : réessayez dans un instant.', common);
  return error;
}

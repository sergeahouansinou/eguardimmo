import { ApiError } from '@eguardimmo/api';

export type LegalApiErrorKind = 'unauthenticated' | 'forbidden' | 'not_found' | 'conflict' | 'invalid' | 'unavailable' | 'rate_limited' | 'unexpected_response' | 'no_organization';

export class LegalApiError extends Error {
  readonly kind: LegalApiErrorKind;
  readonly status: number | null;
  readonly code: string;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;

  constructor(kind: LegalApiErrorKind, message: string, options: { status?: number; code?: string; fieldErrors?: Readonly<Record<string, readonly string[]>>; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'LegalApiError';
    this.kind = kind;
    this.status = options.status ?? null;
    this.code = options.code ?? kind;
    this.fieldErrors = options.fieldErrors ?? {};
  }
}

export const NO_ORGANIZATION_MESSAGE = 'Aucune organisation n’est sélectionnée : l’identité légale ne peut pas être chargée.';
export const UNEXPECTED_RESPONSE_MESSAGE = 'Réponse inattendue du serveur. Réessayez dans un instant.';

export const unexpectedResponse = (detail?: string): LegalApiError =>
  new LegalApiError('unexpected_response', detail ? `${UNEXPECTED_RESPONSE_MESSAGE} (${detail})` : UNEXPECTED_RESPONSE_MESSAGE, { code: 'unexpected_response' });

export const FIELD_MESSAGES: Readonly<Record<string, string>> = {
  legal_name: 'La raison sociale est obligatoire (200 caractères au plus).',
  address: 'L’adresse est invalide.',
  line1: 'La première ligne d’adresse est obligatoire (200 caractères au plus).',
  line2: 'Le complément d’adresse est trop long (200 caractères au plus).',
  postal_code: 'Le code postal est obligatoire (12 caractères au plus).',
  city: 'La ville est obligatoire (120 caractères au plus).',
  country: 'Le pays doit être un code à deux lettres majuscules, par exemple FR.',
  siren: 'Le SIREN comporte 9 chiffres.',
  siret: 'Le SIRET comporte 14 chiffres.',
  vat_number: 'Le numéro de TVA est invalide : deux lettres de pays puis 2 à 12 caractères.',
  legal_form: 'La forme juridique est trop longue (80 caractères au plus).',
  share_capital: 'Le capital social est invalide : indiquez un montant positif.',
  registry_city: 'La ville d’immatriculation est trop longue (120 caractères au plus).',
  professional_card_number: 'Le numéro de carte professionnelle est trop long (60 caractères au plus).',
  professional_card_issuer: 'L’autorité émettrice est trop longue (120 caractères au plus).',
  guarantee_provider: 'Le garant est trop long (160 caractères au plus).',
  guarantee_amount: 'Le montant de la garantie est invalide : indiquez un montant positif.',
  vat_regime: 'Le régime de TVA est invalide.',
  vat_on_debits: 'L’option TVA sur les débits est invalide.',
  payment_terms_days: 'Le délai de paiement doit être compris entre 0 et 120 jours.',
};

const lastSegment = (field: string): string => field.split('.').at(-1) ?? field;

const firstFieldMessage = (error: ApiError): string => {
  const field = Object.keys(error.fieldErrors)[0];
  return (field !== undefined ? FIELD_MESSAGES[lastSegment(field)] : undefined) ?? error.firstFieldError() ?? error.message;
};

const waitLabel = (seconds: number | null): string => {
  if (seconds === null || seconds < 1) return 'un peu plus tard';
  if (seconds <= 90) return `dans ${String(seconds)} seconde${seconds > 1 ? 's' : ''}`;
  return `dans ${String(Math.ceil(seconds / 60))} minutes`;
};

export function translateApiError(error: unknown): unknown {
  if (!(error instanceof ApiError)) return error;
  const common = { status: error.status, code: error.code, fieldErrors: error.fieldErrors, cause: error };
  if (error.status === 401) return new LegalApiError('unauthenticated', 'Votre session a expiré. Reconnectez-vous.', common);
  if (error.status === 403) return new LegalApiError('forbidden', 'Seuls le titulaire et les administrateurs peuvent modifier l’identité légale.', common);
  if (error.status === 404) return new LegalApiError('not_found', error.code === 'legal_identity_not_found' ? 'L’identité légale n’est pas encore renseignée.' : error.message, common);
  if (error.status === 409) return new LegalApiError('conflict', error.message, common);
  if (error.status === 422) return new LegalApiError('invalid', firstFieldMessage(error), common);
  if (error.status === 429) return new LegalApiError('rate_limited', `Trop de requêtes en peu de temps. Aucune modification n’a été enregistrée : réessayez ${waitLabel(error.retryAfterSeconds)}.`, common);
  if (error.status === 503) return new LegalApiError('unavailable', 'Le service est momentanément indisponible. Rien n’a été enregistré : réessayez dans un instant.', common);
  return error;
}

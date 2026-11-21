import { ApiError } from '@eguardimmo/api';

export type ReportingApiErrorKind =
  | 'unauthenticated'
  | 'forbidden'
  | 'two_factor_required'
  | 'not_found'
  | 'conflict'
  | 'stale'
  | 'invalid'
  | 'unavailable'
  | 'rate_limited'
  | 'unexpected_response'
  | 'no_organization';

export class ReportingApiError extends Error {
  readonly kind: ReportingApiErrorKind;
  readonly status: number | null;
  readonly code: string;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;

  constructor(kind: ReportingApiErrorKind, message: string, options: { status?: number; code?: string; fieldErrors?: Readonly<Record<string, readonly string[]>>; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'ReportingApiError';
    this.kind = kind;
    this.status = options.status ?? null;
    this.code = options.code ?? kind;
    this.fieldErrors = options.fieldErrors ?? {};
  }
}

export const NO_ORGANIZATION_MESSAGE = 'Aucune organisation n’est sélectionnée : les comptes rendus ne peuvent pas être chargés.';
export const UNEXPECTED_RESPONSE_MESSAGE = 'Réponse inattendue du serveur. Réessayez dans un instant.';
export const TWO_FACTOR_MESSAGE = 'Cet export exige la double authentification. Activez-la dans Mon compte, Connexion et sécurité, puis recommencez.';

export const unexpectedResponse = (detail?: string): ReportingApiError =>
  new ReportingApiError('unexpected_response', detail ? `${UNEXPECTED_RESPONSE_MESSAGE} (${detail})` : UNEXPECTED_RESPONSE_MESSAGE, { code: 'unexpected_response' });

export const invalidInput = (message: string): ReportingApiError => new ReportingApiError('invalid', message, { status: 422, code: 'invalid_input' });

export const CODE_MESSAGES: Readonly<Record<string, string>> = {
  report_not_found: 'Ce compte rendu n’existe pas dans votre organisation.',
  report_mandant_not_found: 'Ce mandant n’existe pas dans votre organisation.',
  report_stale_version: 'Ce compte rendu a été modifié depuis votre lecture, ou le grand livre a changé depuis sa génération : rechargez-le, régénérez-le si besoin, puis recommencez.',
  report_period_overlap: 'Un compte rendu en cours ou publié couvre déjà tout ou partie de cette période pour ce mandant.',
  report_period_invalid: 'La période doit être terminée, couvrir un mandat et ne pas dépasser 12 mois.',
  report_period_not_closed: 'Un compte rendu ne se publie que lorsque tous les mois de sa période sont clos en comptabilité : clôturez les mois concernés, puis publiez.',
  report_not_editable: 'L’état de ce compte rendu ne permet pas cette action. Rechargez la page pour le voir.',
  report_not_publishable: 'Ce compte rendu ne peut pas être publié ni rectifié dans son état actuel.',
  report_idempotency_key_required: 'La clé de saisie est manquante : rechargez la page.',
  report_idempotency_key_reused: 'Cette saisie a déjà été enregistrée avec un contenu différent. Rechargez la page pour en saisir une nouvelle.',
  report_issuer_incomplete: 'Renseignez l’identité légale de l’agence (raison sociale, adresse, SIREN) avant de générer un compte rendu.',
  report_pdf_unavailable: 'Le service de génération des PDF ne répond pas. Rien n’a été enregistré : réessayez dans un instant.',
  report_not_generated: 'Ce compte rendu n’a pas encore de chiffres : générez-le d’abord.',
  statement_too_long: 'Le relevé dépasse le nombre de lignes autorisé : réduisez la période.',
  export_too_large: 'L’export dépasse le nombre de lignes autorisé : réduisez la période.',
  reporting_agency_only: 'Les comptes rendus de gestion sont réservés aux organisations de type agence.',
  reporting_jurisdiction_unsupported: 'La juridiction du siège n’a pas encore de règles pour les comptes rendus de gestion.',
  two_factor_required: TWO_FACTOR_MESSAGE,
  role_forbidden: 'Votre rôle ne permet pas cette action sur les comptes rendus.',
};

const FIELD_MESSAGES: Readonly<Record<string, string>> = {
  period_kind: 'Le type de période est invalide.',
  period_start: 'La date de début est invalide.',
  period_end: 'La date de fin est invalide.',
  mandant_ids: 'Choisissez au moins un mandant (50 au plus).',
  'mandant_ids.*': 'Un des mandants choisis est invalide.',
  sections: 'Choisissez au moins une section.',
  reason: 'Le motif doit contenir entre 10 et 500 caractères.',
  scheduled_for: 'La date de publication doit être dans le futur.',
  lock_version: 'La version du compte rendu est manquante : rechargez la page.',
  month: 'Le mois est invalide.',
  from: 'La date de début est invalide.',
  to: 'La date de fin est invalide : elle ne peut pas précéder le début.',
  cursor: 'La page demandée n’existe plus : revenez à la première page.',
};

const lastSegment = (field: string): string => field.split('.').at(-1) ?? field;

const firstFieldMessage = (error: ApiError): string => {
  const field = Object.keys(error.fieldErrors)[0];
  return (field !== undefined ? (FIELD_MESSAGES[field] ?? FIELD_MESSAGES[lastSegment(field)]) : undefined) ?? error.firstFieldError() ?? error.message;
};

export const waitLabel = (seconds: number | null): string => {
  if (seconds === null || seconds < 1) return 'un peu plus tard';
  if (seconds <= 90) return `dans ${String(seconds)} seconde${seconds > 1 ? 's' : ''}`;
  return `dans ${String(Math.ceil(seconds / 60))} minutes`;
};

export function failureMessage(failure: { code: string; detail: string }): string {
  return CODE_MESSAGES[failure.code] ?? failure.detail;
}

export function translateApiError(error: unknown): unknown {
  if (!(error instanceof ApiError)) return error;
  const common = { status: error.status, code: error.code, fieldErrors: error.fieldErrors, cause: error };
  const known = CODE_MESSAGES[error.code];
  if (error.status === 401) return new ReportingApiError('unauthenticated', 'Votre session a expiré. Reconnectez-vous.', common);
  if (error.status === 403) {
    if (error.code === 'two_factor_required') return new ReportingApiError('two_factor_required', TWO_FACTOR_MESSAGE, common);
    return new ReportingApiError('forbidden', known ?? CODE_MESSAGES.role_forbidden ?? error.message, common);
  }
  if (error.status === 404) return new ReportingApiError('not_found', known ?? error.message, common);
  if (error.status === 409) return new ReportingApiError(error.code === 'report_stale_version' ? 'stale' : 'conflict', known ?? error.message, common);
  if (error.status === 422) return new ReportingApiError('invalid', known ?? firstFieldMessage(error), common);
  if (error.status === 429) return new ReportingApiError('rate_limited', `Trop de requêtes en peu de temps. Aucune modification n’a été enregistrée : réessayez ${waitLabel(error.retryAfterSeconds)}.`, common);
  if (error.status === 503) {
    const base = known ?? 'Le service est momentanément indisponible. Rien n’a été enregistré.';
    return new ReportingApiError('unavailable', `${base.replace(/ : réessayez dans un instant\.$/, '.')} Réessayez ${waitLabel(error.retryAfterSeconds)}.`, common);
  }
  return error;
}

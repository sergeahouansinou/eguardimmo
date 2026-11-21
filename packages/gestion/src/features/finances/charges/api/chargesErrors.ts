import { ApiError } from '@eguardimmo/api';

export type ChargesApiErrorKind =
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

export class ChargesApiError extends Error {
  readonly kind: ChargesApiErrorKind;
  readonly status: number | null;
  readonly code: string;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;

  constructor(kind: ChargesApiErrorKind, message: string, options: { status?: number; code?: string; fieldErrors?: Readonly<Record<string, readonly string[]>>; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'ChargesApiError';
    this.kind = kind;
    this.status = options.status ?? null;
    this.code = options.code ?? kind;
    this.fieldErrors = options.fieldErrors ?? {};
  }
}

export const NO_ORGANIZATION_MESSAGE = 'Aucune organisation n’est sélectionnée : les charges ne peuvent pas être chargées.';
export const UNEXPECTED_RESPONSE_MESSAGE = 'Réponse inattendue du serveur. Réessayez dans un instant.';
export const REAUTHENTICATION_MESSAGE = 'Confirmez votre identité avec un code de double authentification de moins de 10 minutes, puis recommencez.';
export const TWO_FACTOR_MESSAGE = 'Cette action exige la double authentification. Activez-la dans Mon compte, Connexion et sécurité, puis recommencez.';

export const unexpectedResponse = (detail?: string): ChargesApiError =>
  new ChargesApiError('unexpected_response', detail ? `${UNEXPECTED_RESPONSE_MESSAGE} (${detail})` : UNEXPECTED_RESPONSE_MESSAGE, { code: 'unexpected_response' });

export const invalidInput = (message: string): ChargesApiError => new ChargesApiError('invalid', message, { status: 422, code: 'invalid_input' });

export const CODE_MESSAGES: Readonly<Record<string, string>> = {
  expense_not_found: 'Cette dépense n’existe pas dans votre organisation.',
  charge_key_not_found: 'Cette clé de répartition n’existe pas dans votre organisation.',
  charge_exercise_not_found: 'Cet exercice n’existe pas dans votre organisation.',
  charge_statement_not_found: 'Ce décompte n’existe pas dans votre organisation.',
  charges_file_not_found: 'Cette pièce n’existe plus ou n’est pas encore disponible.',
  charges_agency_only: 'Ce mode de règlement n’existe que pour une agence : un bailleur autonome comptabilise toujours la dépense.',
  charges_role_forbidden: 'Votre rôle ne permet pas cette action sur les charges.',
  charges_two_factor_required: TWO_FACTOR_MESSAGE,
  charges_idempotency_key_required: 'La clé de saisie est manquante : rechargez la page.',
  charges_idempotency_key_reused: 'Cette saisie a déjà été enregistrée avec un contenu différent. Rechargez la page pour en saisir une nouvelle.',
  expense_settlement_invalid: 'Ce mode de règlement n’est pas possible pour cette dépense. Une agence règle sur les fonds du mandant, par avance ou payée par le mandant ; un relevé du syndic se saisit pour un lot, sans mode de règlement.',
  expense_split_required: 'Les lots de ce bien relèvent de plusieurs mandants : saisissez une pièce par mandant en choisissant le lot.',
  expense_invalid: 'Cette dépense est invalide : relisez les montants, les dates, la catégorie et la rubrique récupérable.',
  charges_file_invalid: 'Cette pièce est invalide : PDF, JPG ou PNG de 10 Mo au plus.',
  charge_key_incomplete: 'Un lot occupé n’a pas de poids dans la clé de répartition d’un poste : complétez la clé avant de calculer.',
  charge_key_changed_during_period: 'Une clé change pendant l’exercice : coupez l’exercice à la date du changement.',
  charge_key_invalid: 'Cette clé de répartition est invalide : relisez les poids et la date d’effet.',
  charge_exercise_period_invalid: 'La période est invalide : 12 mois au plus, terminée avant aujourd’hui.',
  charge_item_invalid: 'Un poste est invalide : relisez son libellé, sa rubrique, sa répartition et ses sources.',
  charges_jurisdiction_unsupported: 'La régularisation des charges n’est pas encore ouverte pour la juridiction de ce bien.',
  charges_regime_unsupported: 'Le régime de charges d’un bail de ce bien n’est pas pris en charge par la régularisation.',
  charges_prescription_ack_required: 'Cet exercice date de plus de trois ans : reconnaissez le risque de prescription pour l’émettre.',
  charges_plan_invalid: 'Le paiement par douzièmes est impossible pour ce décompte : il n’est possible que sur un solde à payer, avant sa facturation.',
  charges_rectification_invalid: 'Ce décompte ne peut pas être rectifié : seul un décompte émis, non remplacé, se rectifie.',
  charges_pdf_unavailable: 'Le service de PDF est momentanément indisponible. Rien n’est perdu : reprenez dans un instant.',
  expense_duplicate: 'Cette dépense est déjà enregistrée : même pièce, même fournisseur, même montant et mêmes dates.',
  expense_in_use: 'Cette dépense est incluse dans un exercice : écartez l’exercice avant de l’annuler.',
  expense_not_cancellable: 'Cette dépense ne peut pas être annulée dans son état actuel.',
  owner_funds_insufficient: 'Le solde du mandant ne couvre pas ce règlement : saisissez une avance sur fonds propres.',
  trust_funds_gap: 'Les fonds du compte de tiers ne couvrent pas ce que l’agence doit aux mandants et aux locataires : régularisez le cantonnement avant de continuer.',
  charges_second_approver_required: 'La validation doit venir d’une autre personne habilitée que celle qui a saisi la dépense.',
  charge_source_exhausted: 'La part récupérable de cette source est déjà retenue sur d’autres exercices : réduisez le montant retenu.',
  charge_exercise_overlap: 'Un autre exercice non écarté de ce bien chevauche cette période.',
  charge_exercise_state_invalid: 'L’état de cet exercice ne permet pas cette action. Rechargez la page pour le voir.',
  charge_statement_state_invalid: 'L’état de ce décompte ne permet pas cette action. Rechargez la page pour le voir.',
  charge_key_archived: 'Cette clé de répartition est archivée : choisissez-en une autre.',
  charges_owner_funds_not_ready: 'Les fonds des mandants ne sont pas encore rattrapés pour cette période : l’exercice est refusé jusqu’au rattrapage.',
  charges_stale_version: 'Cet exercice a été modifié depuis votre lecture : rechargez-le avant de recommencer.',
  validation_failed: 'Certains champs sont invalides : relisez le formulaire.',
};

const STALE_CODES: readonly string[] = ['charges_stale_version'];
const SERVER_DETAIL_CODES: readonly string[] = ['expense_invalid', 'expense_settlement_invalid', 'charge_item_invalid', 'charge_key_invalid', 'charge_exercise_period_invalid', 'charges_file_invalid'];

const waitLabel = (seconds: number | null): string => {
  if (seconds === null || seconds < 1) return 'un peu plus tard';
  if (seconds <= 90) return `dans ${String(seconds)} seconde${seconds > 1 ? 's' : ''}`;
  return `dans ${String(Math.ceil(seconds / 60))} minutes`;
};

export function translateApiError(error: unknown): unknown {
  if (!(error instanceof ApiError)) return error;
  const common = { status: error.status, code: error.code, fieldErrors: error.fieldErrors, cause: error };
  const known = SERVER_DETAIL_CODES.includes(error.code) ? undefined : CODE_MESSAGES[error.code];
  if (error.status === 401) return new ChargesApiError('unauthenticated', 'Votre session a expiré. Reconnectez-vous.', common);
  if (error.status === 403) {
    if (error.code === 'charges_two_factor_required' || error.code === 'two_factor_required') return new ChargesApiError('two_factor_required', TWO_FACTOR_MESSAGE, common);
    if (error.code === 'reauthentication_required') return new ChargesApiError('reauthentication_required', REAUTHENTICATION_MESSAGE, common);
    return new ChargesApiError('forbidden', known ?? 'Votre rôle ne permet pas cette action sur les charges.', common);
  }
  if (error.status === 404) return new ChargesApiError('not_found', known ?? error.message, common);
  if (error.status === 409) return new ChargesApiError(STALE_CODES.includes(error.code) ? 'stale' : 'conflict', known ?? error.message, common);
  if (error.status === 422) return new ChargesApiError('invalid', (error.code === 'validation_failed' ? error.firstFieldError() : null) ?? known ?? error.firstFieldError() ?? error.message, common);
  if (error.status === 429) return new ChargesApiError('rate_limited', `Trop de requêtes en peu de temps. Aucune modification n’a été enregistrée : réessayez ${waitLabel(error.retryAfterSeconds)}.`, common);
  if (error.status === 503) return new ChargesApiError('unavailable', known ?? 'Le service est momentanément indisponible. Rien n’a été enregistré : réessayez dans un instant.', common);
  return error;
}

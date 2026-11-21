import { ApiError } from '@eguardimmo/api';

export type BankingApiErrorKind =
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

type FieldErrors = Readonly<Record<string, readonly string[]>>;

export class BankingApiError extends Error {
  readonly kind: BankingApiErrorKind;
  readonly status: number | null;
  readonly code: string;
  readonly fieldErrors: FieldErrors;

  constructor(kind: BankingApiErrorKind, message: string, options: { status?: number; code?: string; fieldErrors?: FieldErrors; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'BankingApiError';
    this.kind = kind;
    this.status = options.status ?? null;
    this.code = options.code ?? kind;
    this.fieldErrors = options.fieldErrors ?? {};
  }
}

export const NO_ORGANIZATION_MESSAGE = 'Aucune organisation n’est sélectionnée : le rapprochement bancaire ne peut pas être chargé.';
export const UNEXPECTED_RESPONSE_MESSAGE = 'Réponse inattendue du serveur. Réessayez dans un instant.';
export const REAUTHENTICATION_MESSAGE = 'Confirmez votre identité avec un code de double authentification de moins de 10 minutes, puis recommencez.';
export const TWO_FACTOR_MESSAGE = 'Cette action exige la double authentification. Activez-la dans Mon compte, Connexion et sécurité, puis recommencez.';
export const ROLE_MESSAGE = 'Votre rôle ne donne pas accès au rapprochement bancaire : il est réservé au titulaire, à l’administrateur et au comptable.';

export const unexpectedResponse = (detail?: string): BankingApiError =>
  new BankingApiError('unexpected_response', detail ? `${UNEXPECTED_RESPONSE_MESSAGE} (${detail})` : UNEXPECTED_RESPONSE_MESSAGE, { code: 'unexpected_response' });

export const invalidInput = (message: string): BankingApiError => new BankingApiError('invalid', message, { status: 422, code: 'invalid_input' });

export const CODE_MESSAGES: Readonly<Record<string, string>> = {
  bank_account_not_found: 'Ce compte bancaire n’existe pas dans votre organisation.',
  bank_account_identifier_invalid: 'Cet identifiant de compte n’est pas valide : relisez l’IBAN caractère par caractère.',
  bank_account_currency_unsupported: 'La devise du compte doit être celle de l’organisation.',
  bank_account_role_taken: 'Un compte est déjà suivi pour ce compte du grand livre : remplacez-le ou fermez-le d’abord.',
  bank_account_closed: 'Ce compte bancaire est fermé : aucune opération n’y est possible.',
  bank_account_start_invalid: 'Le début du suivi est refusé : il ne peut pas être dans le futur, ni précéder celui du compte remplacé, ni suivre la fin du mois de fermeture du compte précédent. Aucun mois ne doit rester sans compte suivi.',
  bank_statement_not_found: 'Ce relevé n’existe pas dans votre organisation.',
  bank_statement_format_unsupported: 'Le contenu du fichier ne correspond à aucun format pris en charge : CSV ou camt.053 (versions 001.02 et 001.08).',
  bank_statement_invalid: 'Le fichier n’est pas un relevé valide.',
  bank_statement_too_large: 'Le fichier dépasse la taille ou le nombre de lignes autorisés (10 Mo, 20 000 lignes).',
  bank_statement_account_mismatch: 'Le compte du relevé n’est pas celui que vous avez choisi : vérifiez le compte puis réimportez.',
  bank_statement_void_forbidden: 'Une ligne de ce relevé est pointée ou couverte par un état validé : défaites d’abord les pointages.',
  bank_statement_gap: 'Un relevé manque ou ne se raccorde pas au précédent : importez le relevé manquant.',
  bank_line_not_found: 'Cette ligne n’existe pas dans votre organisation.',
  bank_line_not_matchable: 'Cette ligne ou cette écriture ne peut pas être pointée : déjà pointée, ignorée, d’un autre compte ou de sens incompatible.',
  bank_line_stale: 'Cette ligne a changé depuis votre lecture : la liste est rechargée, vérifiez puis recommencez.',
  bank_match_not_found: 'Ce pointage n’existe pas dans votre organisation.',
  bank_match_unbalanced: 'Le pointage est déséquilibré : la somme des lignes de relevé doit égaler celle des écritures.',
  bank_match_locked: 'Ce pointage entre dans un état de rapprochement validé : il ne peut plus être défait.',
  bank_ignore_forbidden: 'Ignorer cette ligne est impossible. Sur le compte de tiers, seule une paire d’opérations de sens opposé et de montant identique peut être ignorée, et jamais une ligne couverte par un état validé.',
  bank_rule_not_found: 'Cette règle n’existe pas dans votre organisation.',
  bank_reconciliation_not_found: 'Cet état de rapprochement n’existe pas dans votre organisation.',
  bank_reconciliation_balance_required: 'Aucun relevé ne porte de solde de clôture : saisissez le solde du relevé et joignez la pièce.',
  bank_reconciliation_proof_required: 'Un solde saisi à la main exige la pièce qui le justifie : relevé de la banque en PDF ou image.',
  bank_reconciliation_not_actionable: 'Cet état n’est plus modifiable ou les données ont changé : recalculez l’état.',
  bank_reconciliation_unexplained_difference: 'L’écart inexpliqué doit être nul pour valider l’état.',
  banking_idempotency_key_required: 'La clé de saisie est manquante : rechargez la page.',
  banking_idempotency_key_reused: 'Cette saisie a déjà été enregistrée avec un contenu différent. Rechargez la page pour en saisir une nouvelle.',
  banking_request_conflict: 'Une requête concurrente a modifié les mêmes données : relisez l’état puis recommencez.',
  banking_xsd_unavailable: 'L’import camt.053 est momentanément indisponible : les schémas officiels ne sont pas installés sur le serveur. Importez le relevé au format CSV ou réessayez plus tard.',
  bank_cursor_invalid: 'La page demandée n’existe plus : revenez à la première page.',
  role_forbidden: ROLE_MESSAGE,
  two_factor_required: TWO_FACTOR_MESSAGE,
  validation_failed: 'Certains champs sont invalides : relisez le formulaire.',
};

const STALE_CODES: readonly string[] = ['bank_line_stale', 'banking_request_conflict'];
const SERVER_DETAIL_CODES: readonly string[] = ['bank_statement_invalid', 'bank_reconciliation_not_actionable', 'bank_ignore_forbidden'];

const FIELD_MESSAGES: Readonly<Record<string, string>> = {
  file: 'Choisissez un fichier de relevé.',
  format: 'Le format du fichier est invalide : CSV ou camt.053.',
  proof: 'La pièce est invalide : PDF ou image de 10 Mo au plus.',
  month: 'Le mois est invalide.',
  bank_balance: 'Le solde est invalide.',
  reason: 'Le motif doit contenir entre 3 et 255 caractères.',
  identifier: 'L’identifiant du compte est obligatoire (4 à 42 caractères).',
  label: 'Le libellé du compte est obligatoire (120 caractères au plus).',
  holder_name: 'Le titulaire du compte est obligatoire (140 caractères au plus).',
  reconciliation_from: 'La date de début du suivi est invalide.',
  opening_bank_balance: 'Le solde d’ouverture est invalide.',
  lock_version: 'La version de la ligne est manquante : rechargez la page.',
  suggestion_ids: 'Choisissez entre 1 et 50 propositions.',
  journal_line_ids: 'Choisissez au moins une écriture.',
  allocations: 'Répartissez le montant sur 1 à 20 baux.',
  invoice_id: 'Choisissez une facture.',
  amount: 'Le montant est invalide.',
  cursor: 'La page demandée n’existe plus : revenez à la première page.',
};

const lastSegment = (field: string): string => field.split('.').at(-1) ?? field;

function fieldMessage(error: ApiError): string {
  const field = Object.keys(error.fieldErrors)[0];
  const known = field === undefined ? undefined : (FIELD_MESSAGES[field] ?? FIELD_MESSAGES[lastSegment(field)]);
  if (known !== undefined) return known;
  if (field?.startsWith('csv_profile') === true) return 'Le profil CSV est invalide : relisez le séparateur, les formats et les colonnes.';
  return CODE_MESSAGES.validation_failed ?? error.message;
}

const waitLabel = (seconds: number | null): string => {
  if (seconds === null || seconds < 1) return 'un peu plus tard';
  if (seconds <= 90) return `dans ${String(seconds)} seconde${seconds > 1 ? 's' : ''}`;
  return `dans ${String(Math.ceil(seconds / 60))} minutes`;
};

export function translateApiError(error: unknown): unknown {
  if (!(error instanceof ApiError)) return error;
  const common = { status: error.status, code: error.code, fieldErrors: error.fieldErrors, cause: error };
  const known = CODE_MESSAGES[error.code];
  const detailed = SERVER_DETAIL_CODES.includes(error.code) ? `${known ?? ''} ${error.message}`.trim() : known;
  if (error.status === 401) return new BankingApiError('unauthenticated', 'Votre session a expiré. Reconnectez-vous.', common);
  if (error.status === 403) {
    if (error.code === 'two_factor_required') return new BankingApiError('two_factor_required', TWO_FACTOR_MESSAGE, common);
    if (error.code === 'reauthentication_required') return new BankingApiError('reauthentication_required', REAUTHENTICATION_MESSAGE, common);
    return new BankingApiError('forbidden', ROLE_MESSAGE, common);
  }
  if (error.status === 404) return new BankingApiError('not_found', known ?? 'Élément introuvable dans votre organisation.', common);
  if (error.status === 409) return new BankingApiError(STALE_CODES.includes(error.code) ? 'stale' : 'conflict', detailed ?? 'Cette action est en conflit avec l’état actuel : rechargez la page.', common);
  if (error.status === 413) return new BankingApiError('invalid', CODE_MESSAGES.bank_statement_too_large ?? error.message, common);
  if (error.status === 422) return new BankingApiError('invalid', error.code === 'validation_failed' ? fieldMessage(error) : (detailed ?? fieldMessage(error)), common);
  if (error.status === 429) return new BankingApiError('rate_limited', `Trop de requêtes en peu de temps. Aucune modification n’a été enregistrée : réessayez ${waitLabel(error.retryAfterSeconds)}.`, common);
  if (error.status === 503) return new BankingApiError('unavailable', known ?? 'Le service est momentanément indisponible. Rien n’a été enregistré : réessayez dans un instant.', common);
  return error;
}

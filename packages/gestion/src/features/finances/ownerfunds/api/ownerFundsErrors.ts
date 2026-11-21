import { ApiError } from '@eguardimmo/api';

export type OwnerFundsApiErrorKind =
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

export class OwnerFundsApiError extends Error {
  readonly kind: OwnerFundsApiErrorKind;
  readonly status: number | null;
  readonly code: string;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
  readonly reasons: readonly string[];

  constructor(
    kind: OwnerFundsApiErrorKind,
    message: string,
    options: { status?: number; code?: string; fieldErrors?: Readonly<Record<string, readonly string[]>>; reasons?: readonly string[]; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'OwnerFundsApiError';
    this.kind = kind;
    this.status = options.status ?? null;
    this.code = options.code ?? kind;
    this.fieldErrors = options.fieldErrors ?? {};
    this.reasons = options.reasons ?? [];
  }
}

export const NO_ORGANIZATION_MESSAGE = 'Aucune organisation n’est sélectionnée : les fonds des mandants ne peuvent pas être chargés.';
export const UNEXPECTED_RESPONSE_MESSAGE = 'Réponse inattendue du serveur. Réessayez dans un instant.';
export const REAUTHENTICATION_MESSAGE = 'Confirmez votre identité avec un code de double authentification de moins de 10 minutes, puis recommencez.';
export const TWO_FACTOR_MESSAGE = 'Cette action exige la double authentification. Activez-la dans Mon compte, Connexion et sécurité, puis recommencez.';

export const unexpectedResponse = (detail?: string): OwnerFundsApiError =>
  new OwnerFundsApiError('unexpected_response', detail ? `${UNEXPECTED_RESPONSE_MESSAGE} (${detail})` : UNEXPECTED_RESPONSE_MESSAGE, { code: 'unexpected_response' });

export const invalidInput = (message: string): OwnerFundsApiError => new OwnerFundsApiError('invalid', message, { status: 422, code: 'invalid_input' });

export const CODE_MESSAGES: Readonly<Record<string, string>> = {
  payout_batch_not_found: 'Ce lot de reversements n’existe pas dans votre organisation.',
  payout_item_not_found: 'Ce reversement n’existe pas dans votre organisation.',
  payout_hold_not_found: 'Cette retenue n’existe pas dans votre organisation.',
  owner_funds_mandant_not_found: 'Ce mandant n’existe pas dans votre organisation.',
  owner_funds_mandate_not_found: 'Ce mandat n’existe pas dans votre organisation : rechargez la liste des mandats.',
  trust_deposit_not_found: 'Cet apport n’existe pas dans votre organisation.',
  trust_deposit_not_actionable: 'Cet apport a déjà été confirmé.',
  payout_stale_version: 'Ce lot a été modifié depuis votre lecture : rechargez-le avant de recommencer.',
  payout_not_validatable: 'Ce lot ne peut pas être validé ou exporté dans son état actuel : seul un lot brouillon comportant un mandant inclus se valide, et seul un lot validé s’exporte. Un mandant est aussi déjà dans un autre lot en cours.',
  payout_item_excluded: 'Ce mandant est exclu pour un motif qui ne se lève pas à la main : corrigez la cause (compte de paiement, retenue, fonds) puis préparez un nouveau lot.',
  payout_second_approver_required: 'Un second validateur est requis : le virement doit être exécuté par une autre personne que celle qui a validé le lot.',
  payout_cancel_forbidden: 'Un lot dont un virement est exécuté ne s’annule pas : déclarez un retour bancaire sur ce virement.',
  payout_item_not_actionable: 'L’état de ce reversement ne permet pas cette action. Rechargez la page pour le voir.',
  payout_account_changed: 'Le compte de paiement du mandant a changé depuis la validation du lot. Vérifiez-le, puis cochez la reconnaissance du changement pour exécuter : le virement part vers l’ancien compte figé sur le lot.',
  owner_funds_agency_only: 'Les fonds des mandants sont réservés aux organisations de type agence.',
  owner_funds_idempotency_key_required: 'La clé de saisie est manquante : rechargez la page.',
  owner_funds_idempotency_key_reused: 'Cette saisie a déjà été enregistrée avec un contenu différent. Rechargez la page pour en saisir une nouvelle.',
  owner_funds_insufficient: 'Le solde du mandant ne couvre pas ce règlement : saisissez une avance sur fonds propres.',
  fee_base_missing: 'Le barème du mandat n’indique pas la base des honoraires : passez un avenant au mandat.',
  period_not_closed: 'Les honoraires ne se calculent que sur un mois clos.',
  trust_funds_gap: 'Les fonds du compte de tiers ne couvrent pas ce que l’agence doit aux mandants et aux locataires : régularisez le cantonnement avant de continuer.',
  trust_withdrawal_exceeds_surplus: 'Le prélèvement dépasse l’excédent du compte de tiers.',
  owner_funds_jurisdiction_unsupported: 'La juridiction du siège n’a pas encore de règles pour les fonds des mandants.',
  payout_nothing_to_pay: 'Le net reversable de ce mandant est nul : il n’y a rien à reverser.',
  accounting_period_closed: 'Ce mois est clos : aucune écriture ne peut y être passée.',
  accounting_period_order: 'Les mois se clôturent dans l’ordre : clôturez d’abord le plus ancien mois ouvert.',
  accounting_period_not_closable: 'Ce mois ne peut pas être clos : des contrôles bloquants échouent.',
  invoice_fee_computed_by_server: 'Les honoraires de gestion sont calculés par le serveur : ils ne se saisissent plus à la main.',
  supplier_payment_engagement_required: 'Un engagement est requis avant ce règlement : faites accepter un devis ou approuver l’estimation de l’intervention.',
  supplier_payment_second_approver_required: 'Un second validateur est requis : au-delà du seuil, le règlement doit être fait par une autre personne que celle qui a saisi la facture.',
  payout_account_request_not_found: 'Cette demande de changement de compte n’existe pas dans votre organisation.',
  payout_account_request_not_actionable: 'Cette demande n’est plus en attente de validation : elle a déjà été traitée, retirée ou elle a expiré. Rechargez la liste.',
  payout_account_request_stale: 'Cette demande a changé depuis votre lecture : rechargez la liste avant de recommencer.',
  payout_account_request_pending: 'Une demande de changement de compte est déjà en cours pour ce mandant.',
  payout_account_iban_mismatch: 'L’IBAN saisi ne correspond pas à celui de la demande. Relisez-le sur la pièce du RIB, caractère par caractère.',
  payout_account_holder_mismatch: 'Le titulaire saisi ne correspond pas à celui de la demande. Relisez-le sur la pièce du RIB.',
  payout_account_iban_invalid: 'Cet IBAN n’est pas valide ou son pays n’est pas admis.',
  payout_account_unchanged: 'Ce compte est déjà le compte de paiement actuel du mandant.',
  payout_account_self_approval: 'Vous ne pouvez pas valider cette demande : elle a été déposée par votre propre compte, ou votre compte détient un accès propriétaire à ce mandant. Un autre responsable doit la valider.',
  payout_account_contested: 'Le propriétaire a contesté ce changement : la demande est abandonnée et une retenue totale est posée sur ses reversements. Ne l’approuvez pas et contactez-le à un numéro que vous connaissiez déjà.',
  payout_account_access_revoked: 'L’accès du propriétaire qui avait déposé la demande a été révoqué : la demande est abandonnée. Rechargez la liste.',
  two_factor_required: TWO_FACTOR_MESSAGE,
  role_forbidden: 'Votre rôle ne permet pas cette action sur les fonds des mandants.',
};

const STALE_CODES: readonly string[] = ['payout_stale_version', 'payout_account_request_stale'];

export const CLOSING_REASON_MESSAGES: Readonly<Record<string, string>> = {
  month_not_over: 'le mois n’est pas encore terminé',
  ledger_anomaly: 'le grand livre présente une anomalie à corriger',
  trust_funds_gap: 'les fonds du compte de tiers ne couvrent pas les sommes dues',
  payouts_in_transit_mismatch: 'les virements en cours ne correspondent pas aux reversements en attente',
  bank_reconciliation_missing: 'aucun état de rapprochement bancaire validé pour ce mois : validez-le dans Finances > Banque',
  bank_reconciliation_stale: 'l’état de rapprochement bancaire validé est périmé : recalculez-le et validez-le de nouveau',
};

export const CLOSING_WARNING_MESSAGES: Readonly<Record<string, string>> = {
  pending_payouts_older_than_threshold: 'Des reversements validés attendent leur exécution depuis plus de 10 jours.',
};

const FIELD_MESSAGES: Readonly<Record<string, string>> = {
  mandant_ids: 'Choisissez au moins un mandant (50 au plus).',
  'mandant_ids.*': 'Un des mandants choisis est invalide.',
  mandant_party_id: 'Choisissez un mandant.',
  kind: 'Le type de retenue est invalide.',
  amount: 'Le montant est invalide : indiquez un montant strictement positif.',
  reason: 'Le motif doit contenir entre 3 et 500 caractères.',
  comment: 'Le commentaire est trop long (500 caractères au plus).',
  executed_on: 'La date d’exécution est invalide : elle ne peut pas être dans le futur.',
  reference: 'La référence est invalide : 3 à 64 caractères parmi lettres, chiffres, point, tiret, barre oblique et souligné, sans donnée personnelle.',
  lock_version: 'La version du lot est manquante : rechargez la page.',
  iban: 'L’IBAN est obligatoire (42 caractères au plus).',
  holder_name: 'Le titulaire est obligatoire (200 caractères au plus).',
  month: 'Le mois est invalide.',
  limit: 'Le nombre de mandants demandé est invalide.',
  cursor: 'La page demandée n’existe plus : revenez à la première page.',
};

const lastSegment = (field: string): string => field.split('.').at(-1) ?? field;

const firstFieldMessage = (error: ApiError): string => {
  const field = Object.keys(error.fieldErrors)[0];
  return (field !== undefined ? (FIELD_MESSAGES[field] ?? FIELD_MESSAGES[lastSegment(field)]) : undefined) ?? error.firstFieldError() ?? error.message;
};

const waitLabel = (seconds: number | null): string => {
  if (seconds === null || seconds < 1) return 'un peu plus tard';
  if (seconds <= 90) return `dans ${String(seconds)} seconde${seconds > 1 ? 's' : ''}`;
  return `dans ${String(Math.ceil(seconds / 60))} minutes`;
};

export function closingReasons(detail: string): string[] {
  const match = /^Motifs\s*:\s*(.+?)\.?$/.exec(detail.trim());
  return match?.[1] ? match[1].split(',').map((part) => part.trim()).filter((part) => part !== '') : [];
}

function notClosable(error: ApiError, common: { status: number; code: string; fieldErrors: Readonly<Record<string, readonly string[]>>; cause: unknown }): OwnerFundsApiError {
  const reasons = closingReasons(error.message);
  const text = reasons.map((reason) => CLOSING_REASON_MESSAGES[reason] ?? reason).join(' ; ');
  const base = CODE_MESSAGES.accounting_period_not_closable ?? error.message;
  return new OwnerFundsApiError('conflict', text === '' ? base : `${base} Motifs : ${text}.`, { ...common, reasons });
}

export function translateApiError(error: unknown): unknown {
  if (!(error instanceof ApiError)) return error;
  const common = { status: error.status, code: error.code, fieldErrors: error.fieldErrors, cause: error };
  const known = CODE_MESSAGES[error.code];
  if (error.status === 401) return new OwnerFundsApiError('unauthenticated', 'Votre session a expiré. Reconnectez-vous.', common);
  if (error.status === 403) {
    if (error.code === 'two_factor_required') return new OwnerFundsApiError('two_factor_required', TWO_FACTOR_MESSAGE, common);
    if (error.code === 'reauthentication_required') return new OwnerFundsApiError('reauthentication_required', REAUTHENTICATION_MESSAGE, common);
    return new OwnerFundsApiError('forbidden', known ?? 'Votre rôle ne permet pas cette action sur les fonds des mandants.', common);
  }
  if (error.status === 404) return new OwnerFundsApiError('not_found', known ?? error.message, common);
  if (error.status === 409) {
    if (error.code === 'accounting_period_not_closable') return notClosable(error, common);
    return new OwnerFundsApiError(STALE_CODES.includes(error.code) ? 'stale' : 'conflict', known ?? error.message, common);
  }
  if (error.status === 422) return new OwnerFundsApiError('invalid', known ?? firstFieldMessage(error), common);
  if (error.status === 429) return new OwnerFundsApiError('rate_limited', `Trop de requêtes en peu de temps. Aucune modification n’a été enregistrée : réessayez ${waitLabel(error.retryAfterSeconds)}.`, common);
  if (error.status === 503) return new OwnerFundsApiError('unavailable', known ?? 'Le service est momentanément indisponible. Rien n’a été enregistré : réessayez dans un instant.', common);
  return error;
}

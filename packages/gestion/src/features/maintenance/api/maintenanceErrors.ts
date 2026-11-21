import { ApiError } from '@eguardimmo/api';

export type MaintenanceApiErrorKind =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'stale'
  | 'invalid'
  | 'unavailable'
  | 'rate_limited'
  | 'unexpected_response'
  | 'no_organization';

export class MaintenanceApiError extends Error {
  readonly kind: MaintenanceApiErrorKind;
  readonly status: number | null;
  readonly code: string;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;

  constructor(kind: MaintenanceApiErrorKind, message: string, options: { status?: number; code?: string; fieldErrors?: Readonly<Record<string, readonly string[]>>; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'MaintenanceApiError';
    this.kind = kind;
    this.status = options.status ?? null;
    this.code = options.code ?? kind;
    this.fieldErrors = options.fieldErrors ?? {};
  }
}

export const NO_ORGANIZATION_MESSAGE = 'Aucune organisation n’est sélectionnée : les interventions ne peuvent pas être chargées.';
export const UNEXPECTED_RESPONSE_MESSAGE = 'Réponse inattendue du serveur. Réessayez dans un instant.';
export const STALE_MESSAGE = 'Cette intervention a été modifiée depuis votre lecture : rechargez la page avant de recommencer.';

export const unexpectedResponse = (detail?: string): MaintenanceApiError =>
  new MaintenanceApiError('unexpected_response', detail ? `${UNEXPECTED_RESPONSE_MESSAGE} (${detail})` : UNEXPECTED_RESPONSE_MESSAGE, { code: 'unexpected_response' });

export const invalidInput = (message: string): MaintenanceApiError => new MaintenanceApiError('invalid', message, { status: 422, code: 'invalid_input' });

export const CODE_MESSAGES: Readonly<Record<string, string>> = {
  intervention_not_found: 'Cette intervention n’existe pas dans votre organisation.',
  intervention_lease_not_found: 'Le bail référencé n’existe pas dans votre organisation.',
  intervention_visit_not_found: 'Cette visite n’existe pas sur cette intervention.',
  intervention_quote_not_found: 'Ce devis n’existe pas sur cette intervention.',
  intervention_approval_not_found: 'Cette demande d’accord n’existe pas sur cette intervention.',
  supplier_invoice_not_found: 'Cette facture prestataire n’existe pas sur cette intervention.',
  invoice_allocation_not_found: 'Cette imputation n’existe pas.',
  supplier_payment_not_found: 'Ce règlement n’existe pas.',
  supplier_not_found: 'Ce prestataire n’existe pas dans votre organisation.',
  intervention_file_not_found: 'Cette pièce n’existe pas sur cette intervention.',
  intervention_stale_version: STALE_MESSAGE,
  intervention_transition_invalid: 'L’état actuel de l’intervention ne permet pas cette action. Rechargez la page pour voir son état.',
  maintenance_idempotency_key_reused: 'Cette saisie a déjà été enregistrée avec un contenu différent. Rechargez le formulaire pour en saisir une nouvelle.',
  approval_already_decided: 'Cette demande d’accord a déjà reçu une décision, ou son échéance est dépassée et elle a expiré.',
  approval_already_pending: 'Une demande d’accord est déjà en attente pour cette intervention.',
  supplier_invoice_duplicate: 'Ce numéro de facture est déjà enregistré pour ce prestataire.',
  quote_frozen: 'Ce devis est figé : il a déjà été soumis au mandant et ne peut plus être modifié.',
  quote_status_invalid: 'L’état de ce devis ne permet pas cette action.',
  visit_status_invalid: 'L’état de cette visite ne permet pas cette action (un report de créneau n’est possible que pendant la planification).',
  supplier_invoice_status_invalid: 'L’état de cette facture prestataire ne permet pas cette action.',
  intervention_close_blocked: 'La clôture est bloquée : indiquez un motif en l’absence de facture, ou imputez la facture reçue.',
  intervention_reopen_blocked: 'Cette intervention ne peut pas être rouverte : une facture est déjà enregistrée.',
  supplier_status_invalid: 'L’état de ce prestataire ne permet pas cette action.',
  intervention_lease_not_active: 'Le bail n’est pas actif : une intervention ne peut pas y être rattachée.',
  intervention_too_many_open: 'Trop d’interventions sont déjà ouvertes sur ce lot. Clôturez-en avant d’en créer une autre.',
  intervention_unit_invalid: 'Ce lot n’appartient pas à votre organisation ou ne peut pas recevoir d’intervention.',
  intervention_no_mandate: 'Aucun mandat de gestion ne couvre ce lot : l’intervention ne peut pas être engagée.',
  intervention_mandate_suspended: 'Le mandat de gestion de ce lot est suspendu.',
  intervention_qualification_incomplete: 'La qualification est incomplète : indiquez la nature, la priorité et la responsabilité.',
  intervention_approval_required: 'L’accord du mandant est requis avant cette action : le devis ou l’avenant dépasse la couverture accordée.',
  approval_proof_required: 'Joignez la pièce écrite du mandant (courriel, courrier ou message) pour enregistrer sa décision.',
  intervention_emergency_not_allowed: 'L’engagement en urgence est refusé : l’intervention n’est pas urgente, le mandat ne l’autorise pas, ou l’estimation dépasse le plafond d’urgence (la dérogation ne vaut que pour l’engagement initial).',
  intervention_files_limit: 'Le nombre maximal de pièces sur cette intervention est atteint.',
  intervention_file_invalid: 'Cette pièce est refusée : format non accepté, taille supérieure à 10 Mo, image de plus de 25 millions de pixels, ou preuve déjà utilisée pour une autre décision.',
  supplier_insurance_missing: 'Ce prestataire n’a pas d’assurance valide enregistrée : complétez sa fiche avant de l’assigner.',
  supplier_unavailable: 'Ce prestataire est suspendu ou archivé : choisissez-en un autre.',
  intervention_supplier_required: 'Assignez d’abord un prestataire à cette intervention.',
  quote_total_mismatch: 'Le total saisi ne correspond pas au total calculé des lignes du devis.',
  quote_lines_invalid: 'Le devis doit porter entre 1 et 100 lignes aux montants valides et d’un ordre de grandeur plausible.',
  maintenance_tax_rate_unknown: 'Aucun taux de taxe ne correspond à cette clé à la date du document.',
  maintenance_currency_mismatch: 'La devise du document ne correspond pas à celle de l’intervention.',
  supplier_invoice_totals_invalid: 'Les bases et taxes saisies ne correspondent pas au total déclaré de la facture.',
  supplier_invoice_exceeds_approval: 'Le montant dépasse l’engagement accordé (somme des factures non annulées) : un avenant accepté doit couvrir cette facture avant tout règlement ou imputation.',
  supplier_invoice_not_allocable: 'Cette facture ne peut pas être imputée dans son état actuel.',
  allocation_exceeds_invoice: 'Le cumul des imputations dépasse le total de la facture.',
  allocation_deposit_unavailable: 'Le dépôt de garantie n’est pas disponible pour cette imputation : aucun dépôt ou solde insuffisant.',
  allocation_not_chargeable: 'Cette part n’est pas imputable au destinataire choisi.',
  payment_exceeds_outstanding: 'Le règlement dépasse le reste à payer de la facture.',
  supplier_payment_invalid: 'Ce règlement est invalide : vérifiez le montant et la date.',
  maintenance_jurisdiction_unsupported: 'La juridiction de votre organisation n’a pas encore de règles pour les interventions.',
  idempotency_key_required: 'La clé de saisie est manquante : rechargez le formulaire.',
};

export const THIRD_PARTY_FUNDS_MESSAGES: Readonly<Record<string, string>> = {
  supplier_payment_engagement_required: 'Un engagement est requis avant ce règlement : faites accepter un devis ou approuver l’estimation de l’intervention.',
  owner_funds_insufficient: 'Le solde du mandant ne couvre pas ce règlement : saisissez une avance sur fonds propres.',
  trust_funds_gap: 'Les fonds du compte de tiers ne couvrent pas ce que l’agence doit aux mandants et aux locataires : régularisez le cantonnement avant de continuer.',
  supplier_payment_second_approver_required: 'Un second validateur est requis : au-delà du seuil, le règlement doit être fait par une autre personne que celle qui a saisi la facture.',
  two_factor_required: 'Cette action exige la double authentification. Activez-la dans Mon compte, Connexion et sécurité, puis recommencez.',
};

const FIELD_MESSAGES: Readonly<Record<string, string>> = {
  title: 'Le titre doit contenir entre 3 et 120 caractères.',
  description: 'La description doit contenir entre 3 et 1000 caractères.',
  nature_term_id: 'Choisissez la nature de l’intervention.',
  unit_id: 'Choisissez un lot.',
  priority: 'La priorité est invalide.',
  responsibility: 'La responsabilité est invalide.',
  due_on: 'L’échéance est invalide.',
  estimated_amount: 'L’estimation est invalide : indiquez un montant positif.',
  reason: 'Le motif est invalide.',
  note: 'La note doit contenir entre 3 et 500 caractères.',
  completed_on: 'La date de fin est invalide : elle ne peut pas être dans le futur.',
  supplier_party_id: 'Choisissez un prestataire.',
  scheduled_on: 'La date de visite est invalide : elle ne peut pas être passée.',
  slot: 'Le créneau est invalide.',
  contact_phone: 'Le numéro de téléphone est invalide.',
  reference: 'La référence est obligatoire (60 caractères au plus).',
  kind: 'Le type est invalide.',
  issued_on: 'La date d’émission est invalide : elle ne peut pas être dans le futur.',
  valid_until: 'La date de validité ne peut pas précéder l’émission.',
  file_id: 'Joignez le document justificatif.',
  lines: 'Le document doit porter entre 1 et 100 lignes.',
  label: 'Chaque ligne doit avoir un libellé de 1 à 200 caractères.',
  quantity_milli: 'La quantité d’une ligne est invalide.',
  unit_price: 'Le prix unitaire d’une ligne est invalide.',
  tax_rate_key: 'Choisissez le taux de taxe de chaque ligne.',
  decision: 'La décision est invalide.',
  comment: 'Le commentaire est trop long (500 caractères au plus).',
  proof_file_id: 'Joignez la pièce écrite du mandant.',
  number: 'Le numéro de facture est obligatoire (60 caractères au plus).',
  invoice_on: 'La date de facture est invalide : elle ne peut pas être dans le futur.',
  taxes: 'Indiquez entre 1 et 10 lignes de taxe.',
  base: 'La base d’une ligne de taxe est invalide.',
  tax: 'Le montant de taxe d’une ligne est invalide.',
  target: 'La cible de l’imputation est invalide.',
  share_amount: 'La part imputée est invalide : indiquez un montant strictement positif.',
  wear_basis_points: 'La vétusté est invalide : indiquez un pourcentage entre 0 et 100.',
  basis_note: 'La justification est trop longue (300 caractères au plus).',
  amount: 'Le montant est invalide : indiquez un montant strictement positif.',
  method: 'Le mode de règlement est invalide.',
  paid_on: 'La date du règlement est invalide : elle ne peut pas être dans le futur.',
  idempotency_key: 'La clé de saisie est invalide : rechargez le formulaire.',
  text: 'Le commentaire doit contenir entre 1 et 500 caractères.',
  file: 'La pièce est invalide : 10 Mo au plus.',
  party_id: 'Choisissez la société ou la personne du prestataire.',
  trade_term_ids: 'Les métiers choisis sont invalides.',
  payment_terms_days: 'Le délai de règlement doit être compris entre 0 et 365 jours.',
  internal_note: 'La note interne est trop longue (500 caractères au plus).',
  lock_version: 'La version de l’intervention est manquante : rechargez la page.',
  intervention_id: 'L’intervention demandée est invalide.',
  status: 'Le statut demandé est invalide.',
  cursor: 'La page demandée n’existe plus : revenez à la première page.',
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
  const known = CODE_MESSAGES[error.code] ?? THIRD_PARTY_FUNDS_MESSAGES[error.code];
  if (error.status === 401) return new MaintenanceApiError('unauthenticated', 'Votre session a expiré. Reconnectez-vous.', common);
  if (error.status === 403) return new MaintenanceApiError('forbidden', THIRD_PARTY_FUNDS_MESSAGES[error.code] ?? 'Votre rôle ne permet pas cette action sur les interventions.', common);
  if (error.status === 404) return new MaintenanceApiError('not_found', known ?? error.message, common);
  if (error.status === 409) return new MaintenanceApiError(error.code === 'intervention_stale_version' ? 'stale' : 'conflict', known ?? error.message, common);
  if (error.status === 422) return new MaintenanceApiError('invalid', known ?? firstFieldMessage(error), common);
  if (error.status === 429) return new MaintenanceApiError('rate_limited', `Trop de requêtes en peu de temps. Aucune modification n’a été enregistrée : réessayez ${waitLabel(error.retryAfterSeconds)}.`, common);
  if (error.status === 503) return new MaintenanceApiError('unavailable', 'Le service des interventions est momentanément indisponible. Rien n’a été enregistré : réessayez dans un instant.', common);
  return error;
}

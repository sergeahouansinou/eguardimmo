import { ApiError } from '@eguardimmo/api';
import { SEND_LIMIT_PER_INVOICE, SEND_LIMIT_PER_ORGANIZATION } from '../model';

export type InvoicingApiErrorKind =
  | 'unauthenticated'
  | 'forbidden'
  | 'agency_only'
  | 'not_found'
  | 'conflict'
  | 'invalid'
  | 'unavailable'
  | 'rate_limited'
  | 'unexpected_response'
  | 'no_organization'
  | 'unsupported';

export class InvoicingApiError extends Error {
  readonly kind: InvoicingApiErrorKind;
  readonly status: number | null;
  readonly code: string;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;

  constructor(kind: InvoicingApiErrorKind, message: string, options: { status?: number; code?: string; fieldErrors?: Readonly<Record<string, readonly string[]>>; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'InvoicingApiError';
    this.kind = kind;
    this.status = options.status ?? null;
    this.code = options.code ?? kind;
    this.fieldErrors = options.fieldErrors ?? {};
  }
}

export const NO_ORGANIZATION_MESSAGE = 'Aucune organisation n’est sélectionnée : la facturation ne peut pas être chargée.';
export const UNEXPECTED_RESPONSE_MESSAGE = 'Réponse inattendue du serveur. Réessayez dans un instant.';
export const AGENCY_ONLY_MESSAGE = 'La facturation est réservée aux organisations de type agence.';

export const unexpectedResponse = (detail?: string): InvoicingApiError =>
  new InvoicingApiError('unexpected_response', detail ? `${UNEXPECTED_RESPONSE_MESSAGE} (${detail})` : UNEXPECTED_RESPONSE_MESSAGE, { code: 'unexpected_response' });

export const unsupported = (message: string): InvoicingApiError => new InvoicingApiError('unsupported', message, { code: 'unsupported' });

export const invalidInput = (message: string): InvoicingApiError => new InvoicingApiError('invalid', message, { status: 422, code: 'invalid_input' });

const CODE_MESSAGES: Readonly<Record<string, string>> = {
  invoice_not_found: 'Cette facture n’existe pas dans votre organisation.',
  invoice_payment_not_found: 'Ce règlement n’existe pas dans votre organisation.',
  invoicing_agency_only: AGENCY_ONLY_MESSAGE,
  invoice_jurisdiction_unsupported: 'La juridiction du siège de votre agence n’a pas encore de règles de facturation.',
  invoice_item_forbidden_for_tenant: 'Les frais de relance ou de procédure se refacturent au mandant, jamais à un locataire d’habitation.',
  invoice_stale_version: 'Ce brouillon a été modifié depuis votre lecture : rechargez la page avant de l’enregistrer.',
  invoice_credit_exceeds_outstanding: 'Le cumul des avoirs ne peut pas dépasser le reste dû de la facture.',
  invoice_credit_exceeds_line: 'Le cumul des avoirs d’une ligne ne peut pas dépasser sa quantité facturée.',
  invoice_payment_exceeds_outstanding: 'Le règlement dépasse le reste dû de la facture.',
  invoice_idempotency_key_reused: 'Cette saisie a déjà été enregistrée avec un contenu différent. Rechargez le formulaire pour en saisir une nouvelle.',
  invoice_issuer_incomplete: 'Renseignez l’identité légale de votre agence (raison sociale, adresse, SIREN, numéro de TVA) avant d’émettre une facture.',
  invoice_recipient_incomplete: 'Un destinataire professionnel doit avoir une adresse et un SIREN ; une partie anonymisée ne peut pas être facturée.',
  invoice_recipient_email_missing: 'Le destinataire n’a pas d’adresse e-mail principale : ajoutez-en une sur sa fiche avant l’envoi.',
  invoice_einvoicing_required: 'Ce destinataire assujetti doit recevoir une facture électronique : l’émission en PDF seul est refusée.',
  invoice_not_draft: 'Seul un brouillon peut être modifié, émis ou abandonné.',
  invoice_not_issued: 'Cette pièce n’a pas encore été émise.',
  invoice_not_creditable: 'Seule une facture émise, non totalement annulée, peut recevoir un avoir.',
  invoice_not_payable: 'Seule une facture émise ayant un reste dû peut recevoir un règlement.',
  invoice_tax_rate_unknown: 'Aucun taux de taxe ne correspond à cette catégorie à la date de la facture.',
  invoice_tax_rate_not_allowed: 'Ce taux ou cette catégorie de TVA n’est pas autorisé pour cette nature de ligne ou ce destinataire. L’autoliquidation exige un destinataire société avec numéro de TVA.',
  invoice_lines_invalid: 'La facture doit porter entre 1 et 100 lignes aux montants valides.',
  invoice_references_inconsistent: 'Le destinataire doit être partie au bail référencé (ou le mandant d’un mandat qui couvre un lot du bail). Sans bail, un mandat ne se facture qu’à son mandant.',
  invoice_due_date_invalid: 'L’échéance ne peut pas précéder la date d’émission.',
  invoice_payment_invalid: 'La date du règlement doit être comprise entre l’émission de la facture et aujourd’hui.',
};

const FIELD_MESSAGES: Readonly<Record<string, string>> = {
  recipient_party_id: 'Choisissez le destinataire de la facture.',
  due_on: 'L’échéance est invalide.',
  service_from: 'Le début de la période de prestation est invalide.',
  service_to: 'La fin de la période de prestation est invalide ou antérieure à son début.',
  lines: 'La facture doit porter entre 1 et 100 lignes.',
  item_term_id: 'Choisissez la nature de chaque ligne.',
  description: 'Chaque ligne doit avoir un libellé de 1 à 255 caractères.',
  quantity_milli: 'La quantité d’une ligne est invalide.',
  unit_price: 'Le prix unitaire d’une ligne est invalide.',
  tax_category: 'La catégorie de taxe d’une ligne est invalide.',
  amount: 'Le montant est invalide : indiquez un montant strictement positif.',
  method: 'Le mode de règlement est invalide.',
  paid_on: 'La date du règlement est invalide : elle ne peut pas être dans le futur.',
  reference: 'La référence est trop longue (120 caractères au plus).',
  reason: 'Le motif doit contenir entre 2 et 255 caractères.',
  line_id: 'Une ligne de l’avoir est invalide.',
  idempotency_key: 'La clé de saisie est invalide : rechargez le formulaire.',
  year: 'L’année demandée est invalide.',
  cursor: 'La page demandée n’existe plus : revenez à la première page.',
};

const lastSegment = (field: string): string => field.split('.').at(-1) ?? field;

const firstFieldMessage = (error: ApiError): string => {
  const field = Object.keys(error.fieldErrors)[0];
  return (field !== undefined ? FIELD_MESSAGES[lastSegment(field)] : undefined) ?? error.firstFieldError() ?? error.message;
};

const pdfRetryMessage = (seconds: number | null): string =>
  seconds === null
    ? 'Le service de génération des PDF est momentanément indisponible. Rien n’a été enregistré : réessayez dans un instant.'
    : `Le service de génération des PDF est momentanément indisponible. Rien n’a été enregistré : réessayez dans ${String(seconds)} secondes.`;

export function translateApiError(error: unknown): unknown {
  if (!(error instanceof ApiError)) return error;
  const common = { status: error.status, code: error.code, fieldErrors: error.fieldErrors, cause: error };
  const known = CODE_MESSAGES[error.code];
  if (error.status === 401) return new InvoicingApiError('unauthenticated', 'Votre session a expiré. Reconnectez-vous.', common);
  if (error.status === 403) {
    if (error.code === 'invoicing_agency_only') return new InvoicingApiError('agency_only', AGENCY_ONLY_MESSAGE, common);
    return new InvoicingApiError('forbidden', 'Votre rôle ne permet pas cette action sur la facturation.', common);
  }
  if (error.status === 404) return new InvoicingApiError('not_found', known ?? error.message, common);
  if (error.status === 409) return new InvoicingApiError('conflict', known ?? error.message, common);
  if (error.status === 422) return new InvoicingApiError('invalid', known ?? firstFieldMessage(error), common);
  if (error.status === 429) return new InvoicingApiError('rate_limited', 'Trop de requêtes en peu de temps. Patientez quelques secondes puis réessayez.', common);
  if (error.status === 503) return new InvoicingApiError('unavailable', error.code === 'invoice_pdf_unavailable' ? pdfRetryMessage(error.retryAfterSeconds) : error.message, common);
  return error;
}

function waitLabel(seconds: number | null): string {
  if (seconds === null || seconds < 1) return 'un peu plus tard';
  if (seconds <= 90) return `dans ${String(seconds)} seconde${seconds > 1 ? 's' : ''}`;
  const minutes = Math.ceil(seconds / 60);
  return `dans ${String(minutes)} minutes`;
}

export function translateSendError(error: unknown): unknown {
  if (!(error instanceof InvoicingApiError) || error.kind !== 'rate_limited') return error;
  const seconds = error.cause instanceof ApiError ? error.cause.retryAfterSeconds : null;
  const message = `Limite d’envois atteinte : ${String(SEND_LIMIT_PER_INVOICE)} envois par heure pour une même facture, ${String(SEND_LIMIT_PER_ORGANIZATION)} par heure pour l’organisation. Aucun e-mail n’a été mis en file : réessayez ${waitLabel(seconds)}.`;
  return new InvoicingApiError('rate_limited', message, { status: error.status ?? 429, code: error.code, fieldErrors: error.fieldErrors, cause: error.cause });
}

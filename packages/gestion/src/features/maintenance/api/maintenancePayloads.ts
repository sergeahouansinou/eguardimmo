import { parseMinorUnits, parseQuantityMilli, parseUnitPrice } from '../amounts';
import { ALLOCATION_TARGETS, APPROVAL_DECISIONS, DECLINE_REASONS, FILE_KINDS, PAYMENT_METHODS, PRIORITIES, QUOTE_KINDS, RESPONSIBILITIES, VISIT_SLOTS } from '../model';
import type {
  AllocationInput,
  CommentInput,
  CompleteInput,
  CreateInput,
  DeclineInput,
  DecisionInput,
  EngageInput,
  FileInput,
  QualifyInput,
  QuoteInput,
  SupplierInput,
  SupplierInvoiceInput,
  SupplierPaymentInput,
  VisitInput,
} from '../model';
import { invalidInput } from './maintenanceErrors';

const MAX_MINOR = 100_000_000_000;
const KEY_PATTERN = /^[A-Za-z0-9._:-]{8,64}$/;
const BODY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,120}$/;
const PHONE_PATTERN = /^[0-9+().\s-]{6,32}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_LINES = 100;
const MAX_TAXES = 10;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

const isRealDate = (value: string): boolean => {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const requiredDate = (value: string, label: string, today: string, bounds: { past?: boolean; future?: boolean }): string => {
  if (!isRealDate(value) || value < '2000-01-01' || value >= '2100-01-01') throw invalidInput(`${label} est invalide.`);
  if (bounds.past === true && value > today) throw invalidInput(`${label} ne peut pas être dans le futur.`);
  if (bounds.future === true && value < today) throw invalidInput(`${label} ne peut pas être passée.`);
  return value;
};

const optionalDate = (value: string, label: string): string | null => {
  if (value === '') return null;
  if (!isRealDate(value) || value < '2000-01-01' || value >= '2100-01-01') throw invalidInput(`${label} est invalide.`);
  return value;
};

const text = (value: string, label: string, min: number, max: number): string => {
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) throw invalidInput(`${label} doit contenir entre ${String(min)} et ${String(max)} caractères.`);
  return trimmed;
};

const optionalText = (value: string, label: string, max: number): string | null => {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (trimmed.length > max) throw invalidInput(`${label} ne peut pas dépasser ${String(max)} caractères.`);
  return trimmed;
};

const minor = (value: string, currency: Parameters<typeof parseMinorUnits>[1], label: string, allowZero = false): number => {
  const parsed = parseMinorUnits(value, currency);
  if (parsed === null || parsed > MAX_MINOR || (!allowZero && parsed <= 0)) throw invalidInput(`${label} est invalide : indiquez un montant ${allowZero ? 'positif ou nul' : 'strictement positif'}.`);
  return parsed;
};

const oneOf = <T extends string>(values: readonly T[], value: string, label: string): T => {
  const found = values.find((candidate) => candidate === value);
  if (found === undefined) throw invalidInput(`${label} est invalide.`);
  return found;
};

export const checkHeaderKey = (key: string): string => {
  if (!KEY_PATTERN.test(key)) throw invalidInput('La clé de saisie est invalide : rechargez le formulaire.');
  return key;
};

const checkBodyKey = (key: string): string => {
  if (!BODY_KEY_PATTERN.test(key)) throw invalidInput('La clé de saisie est invalide : rechargez le formulaire.');
  return key;
};

export function createPayload(input: CreateInput): Record<string, unknown> {
  if (input.unitId === '') throw invalidInput('Choisissez le lot concerné.');
  if (input.natureTermId === '') throw invalidInput('Choisissez la nature de l’intervention.');
  return {
    unit_id: input.unitId,
    nature_term_id: input.natureTermId,
    title: text(input.title, 'Le titre', 3, 120),
    description: text(input.description, 'La description', 3, 1000),
    room: optionalText(input.room, 'La pièce', 80),
    availability: optionalText(input.availability, 'Les disponibilités', 200),
    priority: oneOf(PRIORITIES, input.priority, 'La priorité'),
  };
}

export function qualifyPayload(input: QualifyInput): Record<string, unknown> {
  return {
    lock_version: input.lockVersion,
    priority: oneOf(PRIORITIES, input.priority, 'La priorité'),
    responsibility: oneOf(RESPONSIBILITIES, input.responsibility, 'La responsabilité'),
    nature_term_id: input.natureTermId,
    due_on: optionalDate(input.dueOn, 'L’échéance'),
    estimated_amount: input.estimatedAmount.trim() === '' ? null : minor(input.estimatedAmount, input.currency, 'L’estimation', true),
  };
}

export const declinePayload = (input: DeclineInput): Record<string, unknown> => ({
  lock_version: input.lockVersion,
  reason: oneOf(DECLINE_REASONS, input.reason, 'Le motif'),
  note: text(input.note, 'La note', 3, 500),
});

export function engagePayload(input: EngageInput): Record<string, unknown> {
  const reason = input.reason.trim();
  if (input.basis === 'emergency' && reason.length < 3) throw invalidInput('Indiquez le motif de l’urgence (3 caractères au moins).');
  if (reason.length > 500) throw invalidInput('Le motif ne peut pas dépasser 500 caractères.');
  return { lock_version: input.lockVersion, basis: input.basis, reason: reason === '' ? null : reason };
}

export const completePayload = (input: CompleteInput, today: string): Record<string, unknown> => ({
  lock_version: input.lockVersion,
  completed_on: requiredDate(input.completedOn, 'La date de fin', today, { past: true }),
  note: text(input.note, 'Le compte rendu', 3, 1000),
});

export const commentPayload = (input: CommentInput): Record<string, unknown> => ({
  text: text(input.text, 'Le commentaire', 1, 500),
  visible_to_tenant: input.visibleToTenant,
  visible_to_owner: input.visibleToOwner,
});

export function filePayload(input: FileInput): FormData {
  if (input.file.size > MAX_FILE_BYTES) throw invalidInput('La pièce dépasse 10 Mo.');
  const body = new FormData();
  body.set('file', input.file);
  body.set('kind', oneOf(FILE_KINDS, input.kind, 'Le type de pièce'));
  body.set('visible_to_tenant', input.visibleToTenant ? '1' : '0');
  body.set('visible_to_owner', input.visibleToOwner ? '1' : '0');
  return body;
}

export function visitPayload(input: VisitInput, today: string): Record<string, unknown> {
  const phone = optionalText(input.contactPhone, 'Le téléphone', 32);
  if (phone !== null && !PHONE_PATTERN.test(phone)) throw invalidInput('Le numéro de téléphone est invalide.');
  return {
    scheduled_on: requiredDate(input.scheduledOn, 'La date de visite', today, { future: true }),
    slot: oneOf(VISIT_SLOTS, input.slot, 'Le créneau'),
    presence_required: input.presenceRequired,
    contact_name: optionalText(input.contactName, 'Le contact', 120),
    contact_phone: phone,
  };
}

export function quotePayload(input: QuoteInput, today: string): Record<string, unknown> {
  if (input.lines.length < 1 || input.lines.length > MAX_LINES) throw invalidInput(`Le devis doit porter entre 1 et ${String(MAX_LINES)} lignes.`);
  const issuedOn = requiredDate(input.issuedOn, 'La date d’émission', today, { past: true });
  const validUntil = optionalDate(input.validUntil, 'La date de validité');
  if (validUntil !== null && validUntil < issuedOn) throw invalidInput('La date de validité ne peut pas précéder l’émission.');
  return {
    reference: text(input.reference, 'La référence', 1, 60),
    kind: oneOf(QUOTE_KINDS, input.kind, 'Le type de devis'),
    issued_on: issuedOn,
    valid_until: validUntil,
    proposed_on: optionalDate(input.proposedOn, 'La date d’exécution proposée'),
    message: optionalText(input.message, 'Le message', 500),
    file_id: requireFile(input.fileId),
    lines: input.lines.map((line, index) => {
      const label = `Ligne ${String(index + 1)}`;
      const quantity = parseQuantityMilli(line.quantity);
      if (quantity === null) throw invalidInput(`${label} : indiquez une quantité positive, avec trois décimales au plus.`);
      const unitPrice = parseUnitPrice(line.unitPrice, input.currency);
      if (unitPrice === null) throw invalidInput(`${label} : indiquez un prix unitaire hors taxe valide.`);
      if (line.taxRateKey === '') throw invalidInput(`${label} : choisissez le taux de taxe.`);
      return { label: text(line.label, `${label} : le libellé`, 1, 200), quantity_milli: quantity, unit: optionalText(line.unit, `${label} : l’unité`, 20), unit_price: unitPrice, tax_rate_key: line.taxRateKey };
    }),
  };
}

function requireFile(fileId: string | null): string {
  if (fileId === null || fileId === '') throw invalidInput('Joignez le document justificatif.');
  return fileId;
}

export function decisionPayload(input: DecisionInput): Record<string, unknown> {
  if (input.proofFileId === null) throw invalidInput('Joignez la pièce écrite du mandant (courriel, courrier ou message).');
  return { decision: oneOf(APPROVAL_DECISIONS, input.decision, 'La décision'), comment: optionalText(input.comment, 'Le commentaire', 500), proof_file_id: input.proofFileId };
}

export function supplierInvoicePayload(input: SupplierInvoiceInput, today: string): Record<string, unknown> {
  if (input.taxes.length < 1 || input.taxes.length > MAX_TAXES) throw invalidInput(`Indiquez entre 1 et ${String(MAX_TAXES)} lignes de taxe.`);
  const invoiceOn = requiredDate(input.invoiceOn, 'La date de facture', today, { past: true });
  const dueOn = optionalDate(input.dueOn, 'L’échéance');
  if (dueOn !== null && dueOn < invoiceOn) throw invalidInput('L’échéance ne peut pas précéder la date de facture.');
  return {
    number: text(input.number, 'Le numéro de facture', 1, 60),
    invoice_on: invoiceOn,
    due_on: dueOn,
    file_id: requireFile(input.fileId),
    taxes: input.taxes.map((tax, index) => {
      const label = `Ligne de taxe ${String(index + 1)}`;
      if (tax.taxRateKey === '') throw invalidInput(`${label} : choisissez le taux.`);
      return { tax_rate_key: tax.taxRateKey, base: minor(tax.base, input.currency, `${label} : la base`, true), tax: minor(tax.tax, input.currency, `${label} : la taxe`, true) };
    }),
    idempotency_key: checkBodyKey(input.idempotencyKey),
  };
}

export function allocationPayload(input: AllocationInput): Record<string, unknown> {
  const wear = input.wearPercent.trim();
  let wearBasisPoints: number | null = null;
  if (wear !== '') {
    if (!/^\d{1,3}([.,]\d{1,2})?$/.test(wear)) throw invalidInput('La vétusté est invalide : indiquez un pourcentage entre 0 et 100.');
    wearBasisPoints = Math.round(Number(wear.replace(',', '.')) * 100);
    if (wearBasisPoints > 10_000) throw invalidInput('La vétusté est invalide : indiquez un pourcentage entre 0 et 100.');
  }
  return {
    target: oneOf(ALLOCATION_TARGETS, input.target, 'La cible'),
    share_amount: minor(input.shareAmount, input.currency, 'La part imputée'),
    wear_basis_points: wearBasisPoints,
    basis_note: optionalText(input.basisNote, 'La justification', 300),
    idempotency_key: checkBodyKey(input.idempotencyKey),
  };
}

export const supplierPaymentPayload = (input: SupplierPaymentInput, today: string): Record<string, unknown> => ({
  amount: minor(input.amount, input.currency, 'Le montant'),
  method: oneOf(PAYMENT_METHODS, input.method, 'Le mode de règlement'),
  paid_on: requiredDate(input.paidOn, 'La date du règlement', today, { past: true }),
  reference: optionalText(input.reference, 'La référence', 120),
  idempotency_key: checkBodyKey(input.idempotencyKey),
});

export function supplierPayload(input: SupplierInput): Record<string, unknown> {
  const days = input.paymentTermsDays.trim();
  if (days !== '' && !/^\d{1,3}$/.test(days)) throw invalidInput('Le délai de règlement doit être compris entre 0 et 365 jours.');
  if (days !== '' && Number(days) > 365) throw invalidInput('Le délai de règlement doit être compris entre 0 et 365 jours.');
  const body: Record<string, unknown> = {
    trade_term_ids: input.tradeTermIds,
    preferred: input.preferred,
    payment_terms_days: days === '' ? null : Number(days),
    internal_note: optionalText(input.internalNote, 'La note interne', 500),
  };
  if (input.supplierId === null) {
    if (input.partyId === null || input.partyId === '') throw invalidInput('Choisissez la société ou la personne du prestataire.');
    body.party_id = input.partyId;
  }
  return body;
}

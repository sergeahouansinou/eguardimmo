import { PAYMENT_METHODS, TAX_CATEGORIES } from '../model';
import type { CreditNoteInput, DraftInput, DraftLineInput, PaymentInput } from '../model';
import { parseMinorUnits, parseQuantityMilli, parseUnitPrice } from '../amounts';
import { invalidInput } from './invoicingErrors';

const MAX_PAYMENT = 100_000_000_000;
const KEY_PATTERN = /^[A-Za-z0-9._:-]{8,120}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_LINES = 100;

const isRealDate = (value: string): boolean => {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const checkKey = (key: string): void => {
  if (!KEY_PATTERN.test(key)) throw invalidInput('La clé de saisie est invalide : rechargez le formulaire.');
};

const optionalDate = (value: string, label: string): string | null => {
  if (value === '') return null;
  if (!isRealDate(value) || value < '2000-01-01' || value >= '2100-01-01') throw invalidInput(`${label} est invalide.`);
  return value;
};

function linePayload(line: DraftLineInput, position: number, input: DraftInput): Record<string, unknown> {
  const label = `Ligne ${String(position)}`;
  if (line.itemTermId === '') throw invalidInput(`${label} : choisissez la nature de la ligne.`);
  const description = line.description.trim();
  if (description.length < 1 || description.length > 255) throw invalidInput(`${label} : le libellé doit contenir de 1 à 255 caractères.`);
  const quantity = parseQuantityMilli(line.quantity);
  if (quantity === null) throw invalidInput(`${label} : indiquez une quantité positive, avec trois décimales au plus.`);
  const unitPrice = parseUnitPrice(line.unitPrice, input.currency);
  if (unitPrice === null) throw invalidInput(`${label} : indiquez un prix unitaire hors taxe valide.`);
  if (!TAX_CATEGORIES.includes(line.taxCategory)) throw invalidInput(`${label} : choisissez la catégorie de taxe.`);
  return { item_term_id: line.itemTermId, description, quantity_milli: quantity, unit_price: unitPrice, tax_category: line.taxCategory };
}

export function draftPayload(input: DraftInput): Record<string, unknown> {
  if (input.recipientPartyId === '') throw invalidInput('Choisissez le destinataire de la facture.');
  if (input.lines.length < 1 || input.lines.length > MAX_LINES) throw invalidInput('La facture doit porter entre 1 et 100 lignes.');
  const dueOn = optionalDate(input.dueOn, 'L’échéance');
  const serviceFrom = optionalDate(input.serviceFrom, 'Le début de la période de prestation');
  const serviceTo = optionalDate(input.serviceTo, 'La fin de la période de prestation');
  if (serviceFrom !== null && serviceTo !== null && serviceTo < serviceFrom) throw invalidInput('La fin de la période de prestation ne peut pas précéder son début.');
  const body: Record<string, unknown> = {
    recipient_party_id: input.recipientPartyId,
    lease_id: input.leaseId,
    mandate_id: input.mandateId,
    due_on: dueOn,
    service_from: serviceFrom,
    service_to: serviceTo,
    lines: input.lines.map((line, index) => linePayload(line, index + 1, input)),
  };
  if (input.invoiceId === null) {
    if (input.idempotencyKey === null) throw invalidInput('La clé de saisie est invalide : rechargez le formulaire.');
    checkKey(input.idempotencyKey);
    body.idempotency_key = input.idempotencyKey;
  } else {
    if (input.lockVersion === null) throw invalidInput('La version du brouillon est inconnue : rechargez la page.');
    body.lock_version = input.lockVersion;
  }
  return body;
}

export function paymentPayload(input: PaymentInput, today: string): Record<string, unknown> {
  const amount = parseMinorUnits(input.amount, input.currency);
  if (amount === null || amount <= 0 || amount > MAX_PAYMENT) throw invalidInput('Indiquez un montant strictement positif.');
  if (!PAYMENT_METHODS.includes(input.method)) throw invalidInput('Choisissez le mode de règlement.');
  if (!isRealDate(input.paidOn) || input.paidOn < '2000-01-01') throw invalidInput('Indiquez la date du règlement.');
  if (input.paidOn > today) throw invalidInput('La date du règlement ne peut pas être dans le futur.');
  const reference = input.reference.trim();
  if (reference.length > 120) throw invalidInput('La référence ne peut pas dépasser 120 caractères.');
  checkKey(input.idempotencyKey);
  return { amount, method: input.method, paid_on: input.paidOn, reference: reference === '' ? null : reference, idempotency_key: input.idempotencyKey };
}

export function creditNotePayload(input: CreditNoteInput): Record<string, unknown> {
  const reason = input.reason.trim();
  if (reason.length < 2 || reason.length > 255) throw invalidInput('Le motif doit contenir entre 2 et 255 caractères.');
  checkKey(input.idempotencyKey);
  if (input.full) return { reason, full: true, idempotency_key: input.idempotencyKey };
  const credited = input.lines.filter((line) => line.quantity.trim() !== '');
  if (credited.length === 0) throw invalidInput('Indiquez la quantité à créditer d’au moins une ligne.');
  const lines = credited.map((line) => {
    const quantity = parseQuantityMilli(line.quantity);
    if (quantity === null) throw invalidInput('Une quantité à créditer est invalide : indiquez un nombre positif, avec trois décimales au plus.');
    return { line_id: line.lineId, quantity_milli: quantity };
  });
  return { reason, full: false, lines, idempotency_key: input.idempotencyKey };
}

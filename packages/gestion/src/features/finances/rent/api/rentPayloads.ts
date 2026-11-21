import { minorDigits } from '../../../../format/money';
import type { Currency } from '../../../../format/money';
import { PAYMENT_METHODS } from '../model';
import type { PaymentInput } from '../model';
import { invalidInput } from './rentErrors';

const MAX_AMOUNT = 100_000_000_000;
const KEY_PATTERN = /^[A-Za-z0-9._:-]{8,120}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseMinorUnits(text: string, currency: Currency): number | null {
  const digits = minorDigits(currency);
  const pattern = digits === 0 ? /^\d+$/ : new RegExp(`^\\d+([.,]\\d{1,${String(digits)}})?$`);
  const value = text.trim();
  if (!pattern.test(value)) return null;
  const [whole = '0', decimals = ''] = value.replace(',', '.').split('.');
  const minor = Number(whole) * 10 ** digits + Number(decimals.padEnd(digits, '0'));
  return Number.isSafeInteger(minor) ? minor : null;
}

export function amountHint(currency: Currency): string {
  return minorDigits(currency) === 0 ? 'Ex. 450000' : 'Ex. 850 ou 850,50';
}

export function paymentPayload(input: PaymentInput, today: string): Record<string, unknown> {
  if (input.leaseId === '') throw invalidInput('Choisissez le bail concerné par ce paiement.');
  const amount = parseMinorUnits(input.amount, input.currency);
  if (amount === null || amount <= 0 || amount > MAX_AMOUNT) throw invalidInput(`Indiquez un montant strictement positif. ${amountHint(input.currency)}.`);
  if (!PAYMENT_METHODS.includes(input.method)) throw invalidInput('Choisissez le mode de règlement.');
  if (!DATE_PATTERN.test(input.receivedOn) || input.receivedOn < '2000-01-01') throw invalidInput('Indiquez la date de réception du paiement.');
  if (input.receivedOn > today) throw invalidInput('La date de réception ne peut pas être dans le futur.');
  if (input.reference.trim().length > 120) throw invalidInput('La référence ne peut pas dépasser 120 caractères.');
  if (input.note.trim().length > 500) throw invalidInput('La note ne peut pas dépasser 500 caractères.');
  if (!KEY_PATTERN.test(input.idempotencyKey)) throw invalidInput('La clé de saisie est invalide : rechargez le formulaire.');
  const reference = input.reference.trim();
  const note = input.note.trim();
  return {
    lease_id: input.leaseId,
    amount,
    method: input.method,
    received_on: input.receivedOn,
    reference: reference === '' ? null : reference,
    note: note === '' ? null : note,
    idempotency_key: input.idempotencyKey,
  };
}

export function reasonPayload(reason: string): { reason: string } {
  const text = reason.trim();
  if (text.length < 2 || text.length > 255) throw invalidInput('Le motif doit contenir entre 2 et 255 caractères.');
  return { reason: text };
}

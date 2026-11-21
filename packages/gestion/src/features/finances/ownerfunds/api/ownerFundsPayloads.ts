import { parseMinorUnits } from '../../rent/api/rentPayloads';
import { HOLD_KINDS, HOLD_REASONS } from '../model';
import type { ApproveRequestInput, ExecuteInput, PlaceHoldInput, TransferInput } from '../model';
import { invalidInput } from './ownerFundsErrors';

export const BATCH_MAX = 50;
const MAX_AMOUNT = 100_000_000_000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const REFERENCE_PATTERN = /^[A-Za-z0-9._/-]+$/;
export const KEY_PATTERN = /^[A-Za-z0-9._:-]{8,120}$/;

export function assertKey(key: string): string {
  if (!KEY_PATTERN.test(key)) throw invalidInput('La clé de saisie est invalide : rechargez la page.');
  return key;
}

export function lockVersionPayload(lockVersion: number): { lock_version: number } {
  if (!Number.isInteger(lockVersion) || lockVersion < 1) throw invalidInput('La version du lot est manquante : rechargez la page.');
  return { lock_version: lockVersion };
}

export function reasonOf(text: string): string {
  const reason = text.trim();
  if (reason.length < 3 || reason.length > 500) throw invalidInput('Indiquez un motif de 3 à 500 caractères.');
  return reason;
}

export function createBatchPayload(mandantIds: readonly string[] | null): Record<string, unknown> {
  if (mandantIds === null) return {};
  if (mandantIds.length < 1 || mandantIds.length > BATCH_MAX) throw invalidInput(`Choisissez entre 1 et ${String(BATCH_MAX)} mandants.`);
  return { mandant_ids: [...new Set(mandantIds)] };
}

function dateOf(value: string, today: string, label: string): string {
  if (!DATE_PATTERN.test(value) || value < '2000-01-01') throw invalidInput(`Indiquez ${label}.`);
  if (value > today) throw invalidInput(`${label.charAt(0).toUpperCase()}${label.slice(1)} ne peut pas être dans le futur.`);
  return value;
}

function referenceOf(text: string, required: boolean): string | null {
  const reference = text.trim();
  if (reference === '' && !required) return null;
  if (reference.length < (required ? 3 : 1) || reference.length > 64 || !REFERENCE_PATTERN.test(reference)) {
    throw invalidInput('La référence bancaire doit compter 3 à 64 caractères : lettres, chiffres, point, tiret, barre oblique ou souligné, sans donnée personnelle.');
  }
  return reference;
}

function amountOf(text: string, currency: TransferInput['currency']): number {
  const amount = parseMinorUnits(text, currency);
  if (amount === null || amount <= 0 || amount > MAX_AMOUNT) throw invalidInput('Indiquez un montant strictement positif.');
  return amount;
}

export function executePayload(input: ExecuteInput, today: string): Record<string, unknown> {
  const reference = referenceOf(input.reference, false);
  return {
    executed_on: dateOf(input.executedOn, today, 'la date du virement'),
    ...(reference === null ? {} : { reference }),
    ...(input.acknowledgeAccountChange ? { acknowledge_account_change: true } : {}),
  };
}

export function holdPayload(input: PlaceHoldInput): Record<string, unknown> {
  if (input.mandantId === '') throw invalidInput('Choisissez un mandant.');
  if (!HOLD_KINDS.includes(input.kind)) throw invalidInput('Choisissez le type de retenue.');
  if (!HOLD_REASONS.includes(input.reason)) throw invalidInput('Choisissez le motif de la retenue.');
  const comment = input.comment.trim();
  if (comment.length > 500) throw invalidInput('Le commentaire ne peut pas dépasser 500 caractères.');
  return {
    mandant_party_id: input.mandantId,
    kind: input.kind,
    ...(input.kind === 'reserve' ? { amount: amountOf(input.amount, input.currency) } : {}),
    reason: input.reason,
    ...(comment === '' ? {} : { comment }),
  };
}

export function withdrawalPayload(input: TransferInput, today: string): Record<string, unknown> {
  const reference = referenceOf(input.reference, false);
  return {
    amount: amountOf(input.amount, input.currency),
    executed_on: dateOf(input.executedOn, today, 'la date du virement'),
    ...(reference === null ? {} : { reference }),
  };
}

export function depositPayload(input: TransferInput, today: string): Record<string, unknown> {
  return {
    amount: amountOf(input.amount, input.currency),
    executed_on: dateOf(input.executedOn, today, 'la date du virement'),
    reference: referenceOf(input.reference, true),
  };
}

export function closePayload(month: string): { month: string } {
  if (!MONTH_PATTERN.test(month) || month < '2000-01') throw invalidInput('Choisissez le mois à clôturer.');
  return { month };
}

const IBAN_SHAPE = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;
const HOLDER_MAX = 200;

function requestVersion(lockVersion: number): number {
  if (!Number.isInteger(lockVersion) || lockVersion < 1) throw invalidInput('La version de la demande est manquante : rechargez la liste.');
  return lockVersion;
}

export function approveRequestPayload(input: ApproveRequestInput): Record<string, unknown> {
  const iban = input.iban.replace(/\s+/g, '').toUpperCase();
  if (!IBAN_SHAPE.test(iban)) throw invalidInput('Cet IBAN n’a pas la forme attendue : deux lettres, deux chiffres, puis 11 à 30 caractères. Recopiez-le depuis la pièce du RIB.');
  const holder = input.holderName.trim();
  if (holder.length < 2 || holder.length > HOLDER_MAX) throw invalidInput('Indiquez le titulaire du compte tel qu’il figure sur la pièce du RIB.');
  return { lock_version: requestVersion(input.lockVersion), iban, holder_name: holder };
}

export function rejectRequestPayload(lockVersion: number, reason: string): Record<string, unknown> {
  return { lock_version: requestVersion(lockVersion), reason: reasonOf(reason) };
}

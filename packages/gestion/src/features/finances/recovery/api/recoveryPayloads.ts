import { MANUAL_ACT_TYPES, MAX_VALID_DAYS } from '../model';
import type { ActInput, OpenCaseInput, ReceivableIds } from '../model';
import { invalidInput } from './recoveryErrors';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_IDS = 100;

export function openCasePayload(input: OpenCaseInput): Record<string, unknown> {
  if (input.leaseId === '' || input.debtorPartyId === '') throw invalidInput('Les créances choisies doivent porter sur un même bail et un même locataire.');
  return { lease_id: input.leaseId, debtor_party_id: input.debtorPartyId, ...idsPayload(input) };
}

function uniqueIds(ids: readonly string[], label: string): string[] {
  const unique = [...new Set(ids)];
  if (unique.length > MAX_IDS) throw invalidInput(`Choisissez ${String(MAX_IDS)} ${label} au plus à la fois.`);
  return unique;
}

export function idsPayload({ installmentIds, invoiceIds }: ReceivableIds): { installment_ids?: string[]; invoice_ids?: string[] } {
  const installments = uniqueIds(installmentIds, 'échéances');
  const invoices = uniqueIds(invoiceIds, 'factures');
  if (installments.length + invoices.length === 0) throw invalidInput('Choisissez au moins une créance.');
  return { ...(installments.length > 0 ? { installment_ids: installments } : {}), ...(invoices.length > 0 ? { invoice_ids: invoices } : {}) };
}

export function optionalReason(reason: string): { reason: string } | Record<string, never> {
  const text = reason.trim();
  if (text.length > 255) throw invalidInput('Le motif ne peut pas dépasser 255 caractères.');
  return text === '' ? {} : { reason: text };
}

export function validDays(days: number): number {
  if (!Number.isInteger(days) || days < 1 || days > MAX_VALID_DAYS) throw invalidInput(`La validité du lien doit être comprise entre 1 et ${String(MAX_VALID_DAYS)} jours.`);
  return days;
}

export function actPayload(input: ActInput, today: string): Record<string, unknown> {
  if (!MANUAL_ACT_TYPES.includes(input.type)) throw invalidInput('Choisissez le type d’acte.');
  if (!DATE_PATTERN.test(input.performedOn) || input.performedOn < '2000-01-01') throw invalidInput('Indiquez la date de l’acte.');
  if (input.performedOn > today) throw invalidInput('La date de l’acte ne peut pas être dans le futur.');
  const note = input.note.trim();
  const reference = input.reference.trim();
  if (note.length > 500) throw invalidInput('La note ne peut pas dépasser 500 caractères.');
  if (reference.length > 120) throw invalidInput('La référence ne peut pas dépasser 120 caractères.');
  return { type: input.type, performed_on: input.performedOn, note: note === '' ? null : note, reference: reference === '' ? null : reference };
}

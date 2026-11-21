import { PERIOD_KINDS, SECTIONS } from '../model';
import type { CreateReportsInput, ReportChanges, ReportOptions } from '../model';
import { invalidInput } from './reportingErrors';

export const BATCH_MAX = 50;
export const REASON_MIN = 10;
export const REASON_MAX = 500;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
export const KEY_PATTERN = /^[A-Za-z0-9._:-]{8,120}$/;

export function assertKey(key: string): string {
  if (!KEY_PATTERN.test(key)) throw invalidInput('La clé de saisie est invalide : rechargez la page.');
  return key;
}

export function dateOf(value: string, label: string): string {
  const parsed = new Date(`${value}T12:00:00Z`);
  if (!DATE_PATTERN.test(value) || value < '2000-01-01' || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw invalidInput(`Indiquez ${label}.`);
  return value;
}

export function monthOf(value: string): string {
  if (!MONTH_PATTERN.test(value)) throw invalidInput('Le mois est invalide.');
  return value;
}

export function rangeOf(from: string, to: string): { from: string; to: string } {
  const start = dateOf(from, 'une date de début valide');
  const end = dateOf(to, 'une date de fin valide');
  if (end < start) throw invalidInput('La date de fin doit suivre la date de début.');
  return { from: start, to: end };
}

const optionsPayload = (options: Partial<ReportOptions>): Record<string, boolean> => ({
  ...(options.letterhead === undefined ? {} : { letterhead: options.letterhead }),
  ...(options.reminderDetail === undefined ? {} : { reminder_detail: options.reminderDetail }),
  ...(options.receiptsAttached === undefined ? {} : { receipts_attached: options.receiptsAttached }),
});

function sectionsOf(sections: readonly string[]): string[] {
  const unique = [...new Set(sections)];
  if (unique.length < 1 || unique.some((section) => !(SECTIONS as readonly string[]).includes(section))) throw invalidInput('Choisissez au moins une section.');
  return unique;
}

export function createPayload(input: CreateReportsInput): Record<string, unknown> {
  if (!PERIOD_KINDS.includes(input.kind)) throw invalidInput('Le type de période est invalide.');
  const { from, to } = rangeOf(input.start, input.end);
  const mandants = [...new Set(input.mandantIds)];
  if (mandants.length < 1 || mandants.length > BATCH_MAX) throw invalidInput(`Choisissez entre 1 et ${String(BATCH_MAX)} mandants.`);
  return {
    period_kind: input.kind,
    period_start: from,
    period_end: to,
    mandant_ids: mandants,
    sections: sectionsOf(input.sections),
    options: optionsPayload(input.options),
    mode: input.generate ? 'generate' : 'draft',
    notify: input.notify,
  };
}

export function updatePayload(lockVersion: number, changes: ReportChanges): Record<string, unknown> {
  if (!Number.isInteger(lockVersion) || lockVersion < 1) throw invalidInput('La version du compte rendu est manquante : rechargez la page.');
  return {
    lock_version: lockVersion,
    ...(changes.sections === undefined ? {} : { sections: sectionsOf(changes.sections) }),
    ...(changes.options === undefined ? {} : { options: optionsPayload(changes.options) }),
    ...(changes.notify === undefined ? {} : { notify: changes.notify }),
  };
}

export function reasonOf(text: string): string {
  const reason = text.trim();
  if (reason.length < REASON_MIN || reason.length > REASON_MAX) throw invalidInput(`Indiquez un motif de ${String(REASON_MIN)} à ${String(REASON_MAX)} caractères.`);
  return reason;
}

export function scheduledFor(value: string): string {
  if (Number.isNaN(Date.parse(value))) throw invalidInput('La date de publication est invalide.');
  return new Date(value).toISOString();
}

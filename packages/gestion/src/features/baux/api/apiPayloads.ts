import { addDays } from '../../locataires/kit/dates';
import { parseEuros } from '../../locataires/kit/money';
import { leaseInputSchema, noticeInputSchema } from '../schemas';
import type { Lease, PaymentMethod } from '../schemas';
import { BauxApiError } from './apiErrors';
import { TERM_GROUPS, currentTerms, inGroup, paymentToApi } from './apiMapping';
import type { TermGroup } from './apiMapping';
import { serverIdSchema } from './apiSchemas';
import type { ApiLease, ApiLeaseParty, ApiTerm } from './apiSchemas';

type Payload = Record<string, unknown>;

export interface DraftValues {
  unitId: string;
  tenantIds: string[];
  furnished: boolean;
  start: string;
  durationMonths: number | null;
  rent: number | null;
  charges: number | null;
  deposit: number | null;
  dueDay: number;
  paymentMethod: PaymentMethod;
  note: string;
  asDraft: boolean;
}

export type ComponentIds = Readonly<Record<TermGroup, string>>;

const invalid = (message: string): BauxApiError => new BauxApiError('invalid', message, { status: 422, code: 'invalid_input' });

const amountOf = (text: string): number | null => (text.trim() === '' ? null : parseEuros(text));

export function draftValues(raw: unknown, today: string): DraftValues {
  const values = leaseInputSchema.parse(raw);
  const duration = Number(values.durationMonths);
  const dueDay = Number(values.dueDay);
  return {
    unitId: values.unitId,
    tenantIds: values.tenantIds,
    furnished: values.furnished,
    start: values.start === '' ? today : values.start,
    durationMonths: Number.isInteger(duration) && duration > 0 ? duration : null,
    rent: amountOf(values.rent),
    charges: amountOf(values.charges),
    deposit: amountOf(values.deposit),
    dueDay: Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 28 ? dueDay : 1,
    paymentMethod: values.paymentMethod,
    note: values.note.trim(),
    asDraft: values.asDraft,
  };
}

export function assertServerIds(values: Pick<DraftValues, 'unitId' | 'tenantIds'>): void {
  if (![values.unitId, ...values.tenantIds].every((id) => serverIdSchema.safeParse(id).success)) {
    throw invalid('Le bien ou le locataire choisi ne provient pas du serveur : sélectionnez des éléments enregistrés.');
  }
}

const termPayload = (term: ApiTerm, leaseStart: string): Payload => ({
  component_term_id: term.component.id,
  amount: term.amount.amount,
  vat_bp: term.vat_bp,
  indexed: term.indexed,
  ...(term.valid_from === leaseStart ? {} : { valid_from: term.valid_from }),
});

function groupLines(existing: readonly ApiTerm[], group: TermGroup, target: number | null, componentId: string, leaseStart: string): Payload[] {
  const { primary } = TERM_GROUPS[group];
  const current = currentTerms(existing, group);
  const secondary = current.filter((term) => term.component.semantic_key !== primary);
  const primaryLine = current.find((term) => term.component.semantic_key === primary);
  const lines = secondary.map((term) => termPayload(term, leaseStart));
  if (target === null) return lines;
  const amount = target - secondary.reduce((sum, term) => sum + term.amount.amount, 0);
  if (amount < 0) throw invalid('Le montant saisi est inférieur aux compléments déjà portés par le bail.');
  if (amount === 0) return lines;
  return [
    {
      component_term_id: primaryLine?.component.id ?? componentId,
      amount,
      vat_bp: primaryLine?.vat_bp ?? 0,
      indexed: primaryLine?.indexed ?? group === 'rent',
      ...(primaryLine === undefined || primaryLine.valid_from === leaseStart ? {} : { valid_from: primaryLine.valid_from }),
    },
    ...lines,
  ];
}

export function termLines(existing: readonly ApiTerm[], values: DraftValues, components: ComponentIds, leaseStart: string): Payload[] {
  const others = existing.filter((term) => !(['rent', 'charges', 'deposit'] as const).some((group) => inGroup(term, group)));
  return [
    ...others.map((term) => termPayload(term, leaseStart)),
    ...groupLines(existing, 'rent', values.rent, components.rent, leaseStart),
    ...groupLines(existing, 'charges', values.charges, components.charges, leaseStart),
    ...groupLines(existing, 'deposit', values.deposit, components.deposit, leaseStart),
  ];
}

const partyPayload = (line: ApiLeaseParty): Payload => ({
  party_id: line.party.id,
  role: line.role,
  joint_liability: line.joint_liability,
  ...(line.guarantees_party_id === null ? {} : { guarantees_party_id: line.guarantees_party_id }),
  ...(line.guarantee === null ? {} : { guarantee_limit_amount: line.guarantee.limit.amount, ...(line.guarantee.ends_on === null ? {} : { guarantee_ends_on: line.guarantee.ends_on }) }),
});

export function partyLines(existing: readonly ApiLeaseParty[], tenantIds: readonly string[]): Payload[] {
  const open = existing.filter((line) => line.end_date === null);
  return [
    ...tenantIds.map((id) => ({ party_id: id, role: 'tenant', joint_liability: open.find((line) => line.role === 'tenant' && line.party.id === id)?.joint_liability ?? false })),
    ...open.filter((line) => line.role !== 'tenant').map(partyPayload),
  ];
}

export function unitLines(existing: ApiLease['units'], unitId: string): Payload[] {
  const annexes = existing.filter((line) => !line.is_main && line.end_date === null && line.unit.id !== unitId);
  return [{ unit_id: unitId, is_main: true }, ...annexes.map((line) => ({ unit_id: line.unit.id, is_main: false }))];
}

export interface RegimeChoice {
  jurisdiction: string;
  regimeKey: string;
}

export function createPayload(values: DraftValues, regime: RegimeChoice, components: ComponentIds): Payload {
  return {
    jurisdiction: regime.jurisdiction,
    regime_key: regime.regimeKey,
    starts_on: values.start,
    ...(values.durationMonths === null ? {} : { duration_months: values.durationMonths }),
    due_day: values.dueDay,
    periodicity: 'monthly',
    billing_timing: 'advance',
    payment_method: paymentToApi(values.paymentMethod),
    jurisdiction_data: { revision_index: 'irl' },
    note: values.note === '' ? null : values.note,
    units: [{ unit_id: values.unitId, is_main: true }],
    parties: partyLines([], values.tenantIds),
    terms: termLines([], values, components, values.start),
  };
}

export function draftUpdatePayload(current: ApiLease, values: DraftValues, regime: RegimeChoice, components: ComponentIds): Payload {
  return {
    lock_version: current.lock_version,
    jurisdiction: regime.jurisdiction,
    regime_key: regime.regimeKey,
    starts_on: values.start,
    ...(values.durationMonths === null ? {} : { duration_months: values.durationMonths }),
    due_day: values.dueDay,
    payment_method: paymentToApi(values.paymentMethod),
    note: values.note === '' ? null : values.note,
    units: unitLines(current.units, values.unitId),
    parties: partyLines(current.parties, values.tenantIds),
    terms: termLines(current.terms, values, components, current.starts_on),
  };
}

export function signedUpdatePayload(current: ApiLease, values: DraftValues): Payload {
  return { lock_version: current.lock_version, payment_method: paymentToApi(values.paymentMethod), note: values.note === '' ? null : values.note };
}

export function structuralChanges(current: Lease, values: DraftValues): string[] {
  const sameTenants = current.tenantIds.length === values.tenantIds.length && current.tenantIds.every((id) => values.tenantIds.includes(id));
  const checks: [string, boolean][] = [
    ['le bien', current.unitId === values.unitId],
    ['les locataires', sameTenants],
    ['le type de location', current.furnished === values.furnished],
    ['la date de début', current.start === values.start],
    ['la durée', values.durationMonths === null || current.durationMonths === values.durationMonths],
    ['le loyer', values.rent === null || current.rent === values.rent],
    ['les charges', values.charges === null || current.charges === values.charges],
    ['le dépôt de garantie', values.deposit === null || current.deposit === values.deposit],
    ['le jour d’échéance', current.dueDay === values.dueDay],
  ];
  return checks.filter(([, same]) => !same).map(([label]) => label);
}

export interface NoticeParts {
  receivedOn: string;
  departure: string;
  reason: string;
}

export function noticeParts(raw: unknown): NoticeParts {
  const input = noticeInputSchema.parse(raw);
  const reason = input.reason.trim();
  if (reason.length < 3) throw invalid('Indiquez le motif du préavis (3 caractères minimum).');
  return { receivedOn: input.noticeReceivedOn, departure: input.departure, reason };
}

export function noticePayload(current: ApiLease, parts: NoticeParts): Payload {
  return {
    lock_version: current.lock_version,
    notice_given_by: 'tenant',
    notice_received_on: parts.receivedOn,
    notice_departure_on: parts.departure,
    termination_reason: parts.reason,
    replace: current.notice !== null,
  };
}

export interface TermChangeInput {
  componentTermId: string;
  amount?: number;
  vatBp?: number;
  indexed?: boolean;
  close?: boolean;
}

export const termChangesPayload = (changes: readonly TermChangeInput[]): Payload[] =>
  changes.map((change) => ({
    component_term_id: change.componentTermId,
    ...(change.close === true ? { close: true } : {}),
    ...(change.amount === undefined ? {} : { amount: change.amount }),
    ...(change.vatBp === undefined ? {} : { vat_bp: change.vatBp }),
    ...(change.indexed === undefined ? {} : { indexed: change.indexed }),
  }));

export interface TerminateInput {
  lastDay: string | null;
  amicable?: boolean;
  reason?: string;
  requestedBy?: 'tenant' | 'landlord';
}

/**
 * L'API lit les fins inclusives (`end_date`) mais écrit les fins exclusives (`ends_on`, `valid_to`) : on convertit ici, jamais ailleurs.
 */
export const exclusiveEnd = (lastDay: string): string => addDays(lastDay, 1);

export function terminatePayload(current: ApiLease, input: TerminateInput): Payload {
  return {
    lock_version: current.lock_version,
    ...(input.lastDay === null ? {} : { ends_on: exclusiveEnd(input.lastDay) }),
    ...(input.amicable === true ? { amicable: true, termination_reason: input.reason ?? '' } : {}),
    ...(input.requestedBy === undefined ? {} : { requested_by: input.requestedBy }),
  };
}

export interface RenewInput {
  durationMonths?: number;
  changes?: readonly TermChangeInput[];
}

export function renewPayload(current: ApiLease, input: RenewInput): Payload {
  return {
    lock_version: current.lock_version,
    ...(input.durationMonths === undefined ? {} : { duration_months: input.durationMonths }),
    ...(input.changes === undefined ? {} : { changes: termChangesPayload(input.changes) }),
  };
}

export function revisePayload(current: ApiLease, input: { effectiveOn: string; changes: readonly TermChangeInput[] }): Payload {
  return { lock_version: current.lock_version, effective_on: input.effectiveOn, reason: 'revision', changes: termChangesPayload(input.changes) };
}

export interface AddPartyInput {
  partyId: string;
  role: 'tenant' | 'guarantor' | 'occupant';
  jointLiability?: boolean;
  validFrom?: string;
  guaranteesPartyId?: string;
  guaranteeLimit?: number;
  guaranteeEndsOn?: string;
}

export const addPartyPayload = (current: ApiLease, input: AddPartyInput): Payload => ({
  lock_version: current.lock_version,
  party_id: input.partyId,
  role: input.role,
  ...(input.jointLiability === undefined ? {} : { joint_liability: input.jointLiability }),
  ...(input.validFrom === undefined ? {} : { valid_from: input.validFrom }),
  ...(input.guaranteesPartyId === undefined ? {} : { guarantees_party_id: input.guaranteesPartyId }),
  ...(input.guaranteeLimit === undefined ? {} : { guarantee_limit_amount: input.guaranteeLimit }),
  ...(input.guaranteeEndsOn === undefined ? {} : { guarantee_ends_on: input.guaranteeEndsOn }),
});

export const endPartyPayload = (current: ApiLease, lastDay: string): Payload => ({ lock_version: current.lock_version, valid_to: exclusiveEnd(lastDay) });

export interface AddUnitInput {
  unitId: string;
  validFrom: string;
  isMain?: boolean;
}

export const addUnitPayload = (current: ApiLease, input: AddUnitInput): Payload => ({
  lock_version: current.lock_version,
  unit_id: input.unitId,
  valid_from: input.validFrom,
  ...(input.isMain === undefined ? {} : { is_main: input.isMain }),
});

export const endUnitPayload = (current: ApiLease, lastDay: string, replaceWithUnitId?: string): Payload => ({
  lock_version: current.lock_version,
  valid_to: exclusiveEnd(lastDay),
  ...(replaceWithUnitId === undefined ? {} : { replace_with_unit_id: replaceWithUnitId }),
});

export const signPayload = (current: ApiLease, signedOn: string): Payload => ({ lock_version: current.lock_version, signed_on: signedOn });

export const cancelPayload = (current: ApiLease): Payload => ({ lock_version: current.lock_version });

export const duplicatePayload = (startsOn: string): Payload => ({ starts_on: startsOn });

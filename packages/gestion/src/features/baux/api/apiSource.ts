import type { ApiClient } from '@eguardimmo/api';
import { addDays, todayIso } from '../../locataires/kit/dates';
import { BAUX_FEATURES } from '../capabilities';
import type { BauxSource } from '../source';
import { EURO_INPUT } from '../schemas';
import type { Lease, LeaseExit } from '../schemas';
import { BauxApiError, unsupported } from './apiErrors';
import { FURNISHED_REGIMES, groupAmount, secondaryAmount, toLease, toLeaseExit, toLeaseRow } from './apiMapping';
import { act, leaseOperations } from './apiOperations';
import { unconnectedOperations } from './apiUnavailable';
import {
  assertServerIds,
  cancelPayload,
  createPayload,
  draftUpdatePayload,
  draftValues,
  duplicatePayload,
  noticeParts,
  noticePayload,
  signPayload,
  signedUpdatePayload,
  structuralChanges,
} from './apiPayloads';
import type { DraftValues } from './apiPayloads';
import { DETAIL_CONCURRENCY, fetchAllLeases, fetchLease, fetchSummaries, knownLease, leasePath, mapLimit, remember } from './apiReads';
import type { ApiContext, LeasePageQuery } from './apiReads';
import { createComponentResolver, resolveRegime } from './apiResolvers';
import { apiLeaseResponseSchema } from './apiSchemas';
import type { ApiLease } from './apiSchemas';
import { createTransport } from './apiTransport';
import { parseEuros } from '../../locataires/kit/money';

export interface ApiBauxSourceOptions {
  client: ApiClient;
  organizationId: string | null;
}

export interface ApiBauxSourceDependencies {
  now?: () => Date;
}

export interface LeasePage {
  items: Lease[];
  nextCursor: string | null;
}

export type ApiBauxSource = BauxSource &
  ReturnType<typeof leaseOperations> & {
    leasePage: (query?: LeasePageQuery) => Promise<LeasePage>;
  };

const INVALID_RENT = 'Indiquez le nouveau loyer, ex. 865 ou 865,50.';
const NOT_DRAFT_CODE = 'lease_not_draft';

export function createApiBauxSource(
  { client, organizationId }: ApiBauxSourceOptions,
  { now = () => new Date() }: ApiBauxSourceDependencies = {},
): ApiBauxSource {
  const transport = createTransport(client, organizationId);
  const context: ApiContext = { transport, latest: new Map(), today: () => todayIso(now()) };
  const components = createComponentResolver(transport);
  const operations = leaseOperations(context);
  let inflight: Promise<ApiLease[]> | null = null;

  const loadAll = (): Promise<ApiLease[]> => {
    inflight ??= fetchAllLeases(context).finally(() => {
      inflight = null;
    });
    return inflight;
  };

  const store = (lease: ApiLease): Lease => toLease(remember(context, lease), context.today());

  const createLease = async (raw: unknown): Promise<Lease> => {
    const values = draftValues(raw, context.today());
    assertServerIds(values);
    const [regime, ids] = await Promise.all([resolveRegime(transport, values.unitId, values.furnished), components()]);
    const { data: created } = await transport.post('/leases', apiLeaseResponseSchema, createPayload(values, regime, ids));
    remember(context, created);
    if (values.asDraft) return toLease(created, context.today());
    try {
      const { data: signed } = await transport.post(`${leasePath(created.id)}/sign`, apiLeaseResponseSchema, signPayload(created, context.today()));
      return store(signed);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'erreur inconnue';
      throw new BauxApiError(error instanceof BauxApiError ? error.kind : 'conflict', `Le bail ${created.reference} est enregistré en brouillon mais n’a pas pu être émis : ${reason}`, { cause: error });
    }
  };

  const regimeFor = (current: ApiLease, values: DraftValues) => {
    const sameKind = FURNISHED_REGIMES.includes(current.regime_key) === values.furnished;
    const sameUnit = (current.main_unit?.id ?? current.units[0]?.unit.id) === values.unitId;
    return sameKind && sameUnit ? Promise.resolve({ jurisdiction: current.jurisdiction, regimeKey: current.regime_key }) : resolveRegime(transport, values.unitId, values.furnished);
  };

  const updateLease = async (id: string, raw: unknown): Promise<Lease> => {
    const current = await knownLease(context, id);
    const values = draftValues(raw, context.today());
    if (current.status === 'draft') {
      assertServerIds(values);
      const [regime, ids] = await Promise.all([regimeFor(current, values), components()]);
      return store((await transport.patch(leasePath(id), apiLeaseResponseSchema, draftUpdatePayload(current, values, regime, ids))).data);
    }
    const changed = structuralChanges(toLease(current, context.today()), values);
    if (changed.length > 0) {
      throw new BauxApiError('conflict', `Un bail signé ne se modifie plus (${changed.join(', ')}) : utilisez une révision de loyer, un avenant ou un renouvellement.`, { status: 409, code: NOT_DRAFT_CODE });
    }
    return store((await transport.patch(leasePath(id), apiLeaseResponseSchema, signedUpdatePayload(current, values))).data);
  };

  const duplicateLease = async (id: string): Promise<Lease> => {
    const current = await knownLease(context, id);
    if (current.end_date === null) throw unsupported(`Le bail ${current.reference} n’a pas de terme : il ne peut pas être dupliqué à la suite.`);
    const { data } = await transport.post(`${leasePath(id)}/duplicate`, apiLeaseResponseSchema, duplicatePayload(addDays(current.end_date, 1)));
    return store(data);
  };

  const setLeaseArchived = async (id: string, archived: boolean): Promise<Lease> => {
    await knownLease(context, id);
    const { data } = archived
      ? await transport.post(`${leasePath(id)}/archive`, apiLeaseResponseSchema)
      : await transport.delete(`${leasePath(id)}/archive`, apiLeaseResponseSchema);
    return store(data);
  };

  const deleteLease = async (id: string): Promise<void> => {
    await act(context, id, '/cancel', cancelPayload);
    await setLeaseArchived(id, true);
  };

  const recordNotice = async (leaseId: string, raw: unknown): Promise<LeaseExit> => {
    const parts = noticeParts(raw);
    const updated = await act(context, leaseId, '/notice', (current) => noticePayload(current, parts));
    const exit = toLeaseExit(updated);
    if (exit === null) throw new BauxApiError('unexpected_response', 'Le préavis n’a pas été retrouvé sur le bail après enregistrement.', { code: 'notice_missing' });
    return exit;
  };

  const reviseRent = async (leaseId: string, rentText: string): Promise<Lease> => {
    if (!EURO_INPUT.test(rentText.trim()) || parseEuros(rentText) <= 0) throw new BauxApiError('invalid', INVALID_RENT, { status: 422, code: 'invalid_input' });
    const [current, ids] = await Promise.all([knownLease(context, leaseId), components()]);
    const total = parseEuros(rentText);
    if (total === groupAmount(current.terms, 'rent')) throw new BauxApiError('invalid', 'Le nouveau loyer est identique au loyer actuel.', { status: 422, code: 'invalid_input' });
    const base = total - secondaryAmount(current.terms, 'rent');
    if (base <= 0) throw new BauxApiError('invalid', 'Le nouveau loyer doit dépasser les compléments de loyer du bail.', { status: 422, code: 'invalid_input' });
    return operations.reviseTerms(leaseId, { effectiveOn: context.today(), changes: [{ componentTermId: ids.rent, amount: base }] });
  };

  const leasePage = async (query: LeasePageQuery = {}): Promise<LeasePage> => {
    const { items, nextCursor } = await fetchSummaries(context, query);
    const details = await mapLimit(items, DETAIL_CONCURRENCY, (summary) => fetchLease(context, summary.id));
    return { items: details.map((detail) => toLeaseRow(detail, context.today())), nextCursor };
  };

  return {
    ...unconnectedOperations,
    ...operations,
    leasePage,
    unavailableInApiMode: BAUX_FEATURES.filter((feature) => feature !== 'schedule'),
    derivesOccupancy: true,
    leases: async () => (await loadAll()).map((lease) => toLeaseRow(lease, context.today())),
    exits: async () => (await loadAll()).flatMap((lease) => toLeaseExit(lease) ?? []),
    createLease,
    updateLease,
    duplicateLease,
    deleteLease,
    setLeaseArchived,
    recordNotice,
    reviseRent,
  };
}

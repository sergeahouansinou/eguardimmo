import type { ApiClient } from '@eguardimmo/api';
import { todayIso } from '../../locataires/kit/dates';
import { maintenancePermissions } from '../permissions';
import type { MaintenanceOrganizationKind, MaintenanceRole } from '../permissions';
import type { InterventionQuery, PartyChoice, QuoteQuery, Replayable } from '../model';
import type { MaintenanceSource } from '../source';
import { toDetail, toIntervention, toParties, toQuoteSummary, toSupplier, toTerm, toUnits } from './maintenanceMapping';
import {
  allocationPayload,
  checkHeaderKey,
  commentPayload,
  completePayload,
  createPayload,
  declinePayload,
  decisionPayload,
  engagePayload,
  filePayload,
  qualifyPayload,
  quotePayload,
  supplierInvoicePayload,
  supplierPaymentPayload,
  supplierPayload,
  visitPayload,
} from './maintenancePayloads';
import {
  apiAck,
  apiFileResponse,
  apiInterventionPage,
  apiInterventionResponse,
  apiPartyPage,
  apiQuotePage,
  apiReplayable,
  apiSupplierPage,
  apiSupplierResponse,
  apiTerms,
  apiUnitPage,
} from './maintenanceSchemas';
import type { z } from 'zod';
import { createMaintenanceTransport } from './maintenanceTransport';

export interface ApiMaintenanceSourceOptions {
  client: ApiClient;
  organizationId: string | null;
  role: MaintenanceRole | null;
  kind: MaintenanceOrganizationKind | null;
}

export interface ApiMaintenanceSourceDependencies {
  now?: () => Date;
  fetchImpl?: typeof fetch;
}

const PAGE_SIZE = 25;
const CHOICE_PAGE_SIZE = 100;
const MAX_CHOICE_PAGES = 10;
const segment = (id: string): string => encodeURIComponent(id);

const interventionQuery = (query: InterventionQuery) => ({
  per_page: query.perPage ?? PAGE_SIZE,
  cursor: query.cursor,
  status: query.status,
  priority: query.priority,
  origin: query.origin,
  overdue: query.overdue === true ? 1 : undefined,
  search: query.search,
  supplier_party_id: query.supplierPartyId,
  unit_id: query.unitId,
  due_from: query.dueFrom,
  due_to: query.dueTo,
});

const quoteQuery = (query: QuoteQuery) => ({
  per_page: query.perPage ?? PAGE_SIZE,
  cursor: query.cursor,
  ...Object.fromEntries((query.statuses ?? []).map((status, index) => [`status[${String(index)}]`, status])),
  intervention_id: query.interventionId,
  supplier_party_id: query.supplierPartyId,
});

const replayable = (data: { id: string; replayed: boolean | null }): Replayable => ({ id: data.id, replayed: data.replayed === true });

export function createApiMaintenanceSource(
  { client, organizationId, role, kind }: ApiMaintenanceSourceOptions,
  { now = () => new Date(), fetchImpl }: ApiMaintenanceSourceDependencies = {},
): MaintenanceSource {
  const transport = createMaintenanceTransport(client, organizationId, fetchImpl);
  const today = (): string => todayIso(now());
  const intervention = (id: string, path = ''): string => `/interventions/${segment(id)}${path}`;
  const act = async (path: string, body?: () => Record<string, unknown>): Promise<void> => {
    await transport.post(path, apiAck, body?.());
  };

  const collect = async <S extends z.ZodType<{ data: unknown[]; meta: { next_cursor: string | null } }>, T>(path: string, schema: S, query: Record<string, string | number | undefined>, convert: (page: z.infer<S>) => T[]): Promise<T[]> => {
    const found: T[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < MAX_CHOICE_PAGES; page += 1) {
      const result: z.infer<S> = await transport.get(path, schema, { ...query, per_page: CHOICE_PAGE_SIZE, cursor });
      found.push(...convert(result));
      cursor = result.meta.next_cursor;
      if (cursor === null) break;
    }
    return found;
  };

  const terms = async (vocabulary: string) => {
    const { data } = await transport.get(`/catalog/vocabularies/${vocabulary}/terms`, apiTerms);
    return data.filter((term) => !term.archived && !term.hidden).map(toTerm);
  };

  return {
    permissions: maintenancePermissions(role, kind),
    interventions: async (query) => {
      const page = await transport.get('/interventions', apiInterventionPage, interventionQuery(query));
      return { items: page.data.map(toIntervention), nextCursor: page.meta.next_cursor };
    },
    intervention: async (id) => toDetail((await transport.get(intervention(id), apiInterventionResponse)).data),
    create: async (input) => {
      const created = await transport.post('/interventions', apiAck, createPayload(input), { 'Idempotency-Key': checkHeaderKey(input.idempotencyKey) });
      return { id: created.data.id, replayed: false };
    },
    qualify: (id, input) => act(intervention(id, '/qualify'), () => qualifyPayload(input)),
    decline: (id, input) => act(intervention(id, '/decline'), () => declinePayload(input)),
    cancel: (id, lockVersion) => act(intervention(id, '/cancel'), () => ({ lock_version: lockVersion })),
    assign: (id, lockVersion, supplierPartyId) => act(intervention(id, '/assign'), () => ({ lock_version: lockVersion, supplier_party_id: supplierPartyId })),
    engage: (id, input) => act(intervention(id, '/engage'), () => engagePayload(input)),
    complete: (id, input) => act(intervention(id, '/complete'), () => completePayload(input, today())),
    close: (id, lockVersion, noInvoiceReason) => act(intervention(id, '/close'), () => ({ lock_version: lockVersion, no_invoice_reason: noInvoiceReason.trim() === '' ? null : noInvoiceReason.trim() })),
    reopen: (id, lockVersion) => act(intervention(id, '/reopen'), () => ({ lock_version: lockVersion })),
    comment: (id, input) => act(intervention(id, '/comments'), () => commentPayload(input)),
    uploadFile: async (id, input) => (await transport.post(intervention(id, '/files'), apiFileResponse, filePayload(input))).data.id,
    downloadFile: (id, fileId) => transport.download(intervention(id, `/files/${segment(fileId)}`)),
    shareFile: async (id, fileId, visibleToOwner) => {
      await transport.patch(intervention(id, `/files/${segment(fileId)}`), apiFileResponse, { visible_to_owner: visibleToOwner });
    },
    addVisit: (id, input) => act(intervention(id, '/visits'), () => visitPayload(input, today())),
    confirmVisit: (id, visitId) => act(intervention(id, `/visits/${segment(visitId)}/confirm`)),
    markVisitDone: (id, visitId) => act(intervention(id, `/visits/${segment(visitId)}/done`)),
    cancelVisit: (id, visitId) => act(intervention(id, `/visits/${segment(visitId)}/cancel`)),
    markVisitNoShow: (id, visitId) => act(intervention(id, `/visits/${segment(visitId)}/no-show`)),
    addQuote: (id, input) => act(intervention(id, '/quotes'), () => quotePayload(input, today())),
    submitQuote: (id, quoteId) => act(intervention(id, `/quotes/${segment(quoteId)}/submit`)),
    acceptQuote: (id, quoteId) => act(intervention(id, `/quotes/${segment(quoteId)}/accept`)),
    refuseQuote: (id, quoteId) => act(intervention(id, `/quotes/${segment(quoteId)}/refuse`)),
    recordDecision: async (id, approvalId, input) =>
      replayable((await transport.post(intervention(id, `/approvals/${segment(approvalId)}/record-decision`), apiReplayable, decisionPayload(input))).data),
    withdrawApproval: (id, approvalId) => act(intervention(id, `/approvals/${segment(approvalId)}/withdraw`)),
    recordInvoice: async (id, input) => replayable((await transport.post(intervention(id, '/invoices'), apiReplayable, supplierInvoicePayload(input, today()))).data),
    cancelInvoice: (id, invoiceId) => act(intervention(id, `/invoices/${segment(invoiceId)}/cancel`)),
    allocate: async (id, invoiceId, input) => replayable((await transport.post(intervention(id, `/invoices/${segment(invoiceId)}/allocations`), apiReplayable, allocationPayload(input))).data),
    cancelAllocation: (allocationId) => act(`/allocations/${segment(allocationId)}/cancel`),
    recordPayment: async (id, invoiceId, input) =>
      replayable((await transport.post(intervention(id, `/invoices/${segment(invoiceId)}/payments`), apiReplayable, supplierPaymentPayload(input, today()))).data),
    cancelPayment: (paymentId) => act(`/supplier-payments/${segment(paymentId)}/cancel`),
    quotes: async (query) => {
      const page = await transport.get('/quotes', apiQuotePage, quoteQuery(query));
      return { items: page.data.map(toQuoteSummary), nextCursor: page.meta.next_cursor };
    },
    supplierChoices: async (): Promise<PartyChoice[]> => {
      const all = await collect('/suppliers', apiSupplierPage, {}, (page) => page.data.map((supplier) => ({ id: supplier.party.id, name: supplier.party.name ?? 'Prestataire sans nom' })));
      return [...new Map(all.map((supplier) => [supplier.id, supplier])).values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    },
    suppliers: async (query) => {
      const page = await transport.get('/suppliers', apiSupplierPage, { per_page: PAGE_SIZE, cursor: query.cursor, status: query.status });
      return { items: page.data.map(toSupplier), nextCursor: page.meta.next_cursor };
    },
    saveSupplier: async (input) => {
      const body = supplierPayload(input);
      if (input.supplierId === null) await transport.post('/suppliers', apiSupplierResponse, body);
      else await transport.patch(`/suppliers/${segment(input.supplierId)}`, apiSupplierResponse, body);
    },
    changeSupplierStatus: async (supplierId, action) => {
      await transport.post(`/suppliers/${segment(supplierId)}/${action}`, apiSupplierResponse);
    },
    units: (search) => collect('/units', apiUnitPage, { q: search === '' ? undefined : search }, toUnits),
    parties: async (): Promise<PartyChoice[]> => {
      const all = await collect('/parties', apiPartyPage, { status: 'all' }, toParties);
      return [...new Map(all.map((party) => [party.id, party])).values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    },
    natureTerms: () => terms('intervention_nature'),
    taxRates: () => terms('tax_rate'),
  };
}

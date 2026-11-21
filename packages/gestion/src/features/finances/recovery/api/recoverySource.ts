import type { ApiClient } from '@eguardimmo/api';
import { todayIso } from '../../../locataires/kit/dates';
import type { Bailiff, CaseQuery, UnpaidQuery } from '../model';
import { recoveryPermissions } from '../permissions';
import type { RecoveryRole } from '../permissions';
import type { RecoverySource } from '../source';
import { toAct, toBundle, toCase, toCaseSummary, toTransmission, toUnpaid } from './recoveryMapping';
import { actPayload, idsPayload, openCasePayload, optionalReason, validDays } from './recoveryPayloads';
import {
  apiActPage,
  apiActResponse,
  apiBailiffTermsSchema,
  apiBundleResponse,
  apiCasePage,
  apiCaseResponse,
  apiPartyPage,
  apiTransmissionResponse,
  apiUnpaidPage,
} from './recoverySchemas';
import type { ApiPartyPage } from './recoverySchemas';
import { createRecoveryTransport } from './recoveryTransport';
import type { RecoveryTransport } from './recoveryTransport';

export interface ApiRecoverySourceOptions {
  client: ApiClient;
  organizationId: string | null;
  role: RecoveryRole | null;
}

export interface ApiRecoverySourceDependencies {
  now?: () => Date;
  fetchImpl?: typeof fetch;
}

const PAGE_SIZE = 25;
const PARTY_PAGE_SIZE = 100;
const MAX_PARTY_PAGES = 10;
const segment = (id: string): string => encodeURIComponent(id);
const recovery = (path: string): string => `/recovery${path}`;

const unpaidQuery = (query: UnpaidQuery) => ({ per_page: query.perPage ?? PAGE_SIZE, after: query.after, lease: query.leaseId });

const caseQuery = (query: CaseQuery) => ({ per_page: query.perPage ?? PAGE_SIZE, cursor: query.cursor, status: query.status, lease: query.leaseId, debtor: query.debtorId });

async function loadBailiffs(transport: RecoveryTransport): Promise<Bailiff[]> {
  const terms = await transport.get('/catalog/vocabularies/contact_category/terms', apiBailiffTermsSchema);
  const found = new Map<string, Bailiff>();
  for (const term of terms.data.filter((candidate) => candidate.semantic_key === 'bailiff' && !candidate.archived)) {
    let cursor: string | null = null;
    for (let page = 0; page < MAX_PARTY_PAGES; page += 1) {
      const result: ApiPartyPage = await transport.get('/parties', apiPartyPage, { category: term.id, per_page: PARTY_PAGE_SIZE, cursor });
      for (const party of result.data) {
        if (party.archived_at === null && !party.is_anonymized) found.set(party.id, { id: party.id, name: party.display_name, email: party.primary_email });
      }
      cursor = result.meta.next_cursor;
      if (cursor === null) break;
    }
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

export function createApiRecoverySource(
  { client, organizationId, role }: ApiRecoverySourceOptions,
  { now = () => new Date(), fetchImpl }: ApiRecoverySourceDependencies = {},
): RecoverySource {
  const transport = createRecoveryTransport(client, organizationId, fetchImpl);
  const caseAction = async (path: string, body: () => Record<string, unknown>) => toCase((await transport.post(recovery(path), apiCaseResponse, body())).data);

  return {
    permissions: recoveryPermissions(role),
    unpaid: async (query) => {
      const page = await transport.get(recovery('/unpaid'), apiUnpaidPage, unpaidQuery(query));
      return { items: page.data.map(toUnpaid), nextAfter: page.meta.next_after };
    },
    cases: async (query) => {
      const page = await transport.get(recovery('/cases'), apiCasePage, caseQuery(query));
      return { items: page.data.map(toCaseSummary), nextCursor: page.meta.next_cursor };
    },
    caseDetail: async (id) => toCase((await transport.get(recovery(`/cases/${segment(id)}`), apiCaseResponse)).data),
    openCase: (input) => caseAction('/cases', () => openCasePayload(input)),
    addItems: (caseId, ids) => caseAction(`/cases/${segment(caseId)}/items`, () => idsPayload(ids)),
    removeItem: async (caseId, itemId) => toCase((await transport.delete(recovery(`/cases/${segment(caseId)}/items/${segment(itemId)}`), apiCaseResponse)).data),
    changeStatus: (caseId, status, reason) => caseAction(`/cases/${segment(caseId)}/status`, () => ({ status, ...optionalReason(reason) })),
    acts: async (caseId, query) => {
      const page = await transport.get(recovery(`/cases/${segment(caseId)}/acts`), apiActPage, { per_page: query.perPage ?? PAGE_SIZE, cursor: query.cursor });
      return { items: page.data.map(toAct), nextCursor: page.meta.next_cursor };
    },
    addAct: async (caseId, input) => toAct((await transport.post(recovery(`/cases/${segment(caseId)}/acts`), apiActResponse, actPayload(input, todayIso(now())))).data),
    generateBundle: async (caseId) => toBundle((await transport.post(recovery(`/cases/${segment(caseId)}/bundles`), apiBundleResponse)).data),
    bundle: async (id) => toBundle((await transport.get(recovery(`/bundles/${segment(id)}`), apiBundleResponse)).data),
    downloadBundle: (id) => transport.zip(recovery(`/bundles/${segment(id)}/download`)),
    bailiffs: () => loadBailiffs(transport),
    transmit: async (bundleId, input) =>
      toTransmission((await transport.post(recovery(`/bundles/${segment(bundleId)}/transmissions`), apiTransmissionResponse, { recipient_party_id: input.recipientPartyId, valid_days: validDays(input.validDays) })).data),
    revoke: async (transmissionId, reason) =>
      toTransmission((await transport.post(recovery(`/transmissions/${segment(transmissionId)}/revoke`), apiTransmissionResponse, optionalReason(reason))).data),
    resend: async (transmissionId, days) =>
      toTransmission((await transport.post(recovery(`/transmissions/${segment(transmissionId)}/resend`), apiTransmissionResponse, { valid_days: validDays(days) })).data),
  };
}

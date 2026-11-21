import type { ApiClient } from '@eguardimmo/api';
import { todayIso } from '../../../locataires/kit/dates';
import { createConfirmProof } from '../../../reauth/proof';
import { ownerFundsPermissions } from '../permissions';
import type { OwnerFundsOrganizationKind, OwnerFundsRole } from '../permissions';
import type { OwnerFundsSource } from '../source';
import { createSimulationSource } from '../simulation/source';
import { toAccount, toBatch, toCoverage, toDeposit, toFee, toHold, toItem, toPayoutRequest, toPeriod, toTransfer } from './ownerFundsMapping';
import { approveRequestPayload, closePayload, createBatchPayload, depositPayload, executePayload, holdPayload, lockVersionPayload, reasonOf, rejectRequestPayload, withdrawalPayload } from './ownerFundsPayloads';
import {
  apiBatchPage,
  apiBatchResponse,
  apiCloseResponse,
  apiCoverageResponse,
  apiDepositPage,
  apiDepositResponse,
  apiEvaluationResponse,
  apiFeePage,
  apiHoldPage,
  apiHoldResponse,
  apiItemResponse,
  apiPartyResponse,
  apiPayoutRequestPage,
  apiPayoutRequestResponse,
  apiPeriodList,
  apiPreviewResponse,
  apiTransferResponse,
} from './ownerFundsSchemas';
import { createOwnerFundsTransport } from './ownerFundsTransport';

export interface ApiOwnerFundsSourceOptions {
  client: ApiClient;
  organizationId: string | null;
  role: OwnerFundsRole | null;
  kind: OwnerFundsOrganizationKind | null;
}

export interface ApiOwnerFundsSourceDependencies {
  now?: () => Date;
  fetchImpl?: typeof fetch;
}

const PAGE_SIZE = 25;
const PROOF_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
const PROOF_EXTENSIONS = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' } as const;
const segment = (id: string): string => encodeURIComponent(id);
const funds = (path: string): string => `/owner-funds${path}`;

export function createApiOwnerFundsSource(
  { client, organizationId, role, kind }: ApiOwnerFundsSourceOptions,
  { now = () => new Date(), fetchImpl }: ApiOwnerFundsSourceDependencies = {},
): OwnerFundsSource {
  const transport = createOwnerFundsTransport(client, organizationId, fetchImpl);
  const batchAction = async (path: string, key: string, body: Record<string, unknown>) => toBatch((await transport.post(funds(path), apiBatchResponse, key, body)).data);
  const itemPath = (batchId: string, itemId: string, action: string) => `/batches/${segment(batchId)}/items/${segment(itemId)}/${action}`;

  return {
    permissions: ownerFundsPermissions(role, kind),
    ...createSimulationSource(transport),
    preview: async (limit) => {
      const response = await transport.get(funds('/payouts/preview'), apiPreviewResponse, { limit });
      return { accounts: response.data.map(toAccount), limit: response.meta.limit, truncated: response.meta.truncated };
    },
    mandantAccount: async (mandantId) => toAccount((await transport.get(funds(`/mandants/${segment(mandantId)}/account`), apiEvaluationResponse)).data),
    partyName: async (partyId) => {
      const party = (await transport.get(`/parties/${segment(partyId)}`, apiPartyResponse)).data;
      return party.is_anonymized ? null : party.display_name;
    },
    batches: async (cursor) => {
      const page = await transport.get(funds('/batches'), apiBatchPage, { per_page: PAGE_SIZE, cursor });
      return { items: page.data.map(toBatch), nextCursor: page.meta.next_cursor };
    },
    batch: async (id) => toBatch((await transport.get(funds(`/batches/${segment(id)}`), apiBatchResponse)).data),
    holds: async (query) => {
      const page = await transport.get(funds('/holds'), apiHoldPage, { per_page: PAGE_SIZE, cursor: query.cursor, mandant: query.mandantId, active: query.activeOnly === true ? 1 : undefined });
      return { items: page.data.map(toHold), nextCursor: page.meta.next_cursor };
    },
    fees: async (query) => {
      const page = await transport.get(funds('/fees'), apiFeePage, { per_page: PAGE_SIZE, cursor: query.cursor, month: query.month, mandant: query.mandantId });
      return { items: page.data.map(toFee), nextCursor: page.meta.next_cursor };
    },
    coverage: async () => toCoverage((await transport.get(funds('/trust/coverage'), apiCoverageResponse)).data),
    deposits: async (cursor) => {
      const page = await transport.get(funds('/trust/deposits'), apiDepositPage, { per_page: PAGE_SIZE, cursor });
      return { items: page.data.map(toDeposit), nextCursor: page.meta.next_cursor };
    },
    periods: async () => (await transport.get('/accounting/periods', apiPeriodList)).data.map(toPeriod).sort((a, b) => b.month.localeCompare(a.month)),
    createBatch: (mandantIds, key) => batchAction('/batches', key, createBatchPayload(mandantIds)),
    includeItem: (batchId, itemId, lockVersion, key) => batchAction(itemPath(batchId, itemId, 'include'), key, lockVersionPayload(lockVersion)),
    excludeItem: (batchId, itemId, lockVersion, key) => batchAction(itemPath(batchId, itemId, 'exclude'), key, lockVersionPayload(lockVersion)),
    placeHold: async (input, key) => toHold((await transport.post(funds('/holds'), apiHoldResponse, key, holdPayload(input))).data),
    releaseHold: async (holdId, key) => toHold((await transport.post(funds(`/holds/${segment(holdId)}/release`), apiHoldResponse, key)).data),
    validateBatch: (batchId, lockVersion, key) => batchAction(`/batches/${segment(batchId)}/validate`, key, lockVersionPayload(lockVersion)),
    cancelBatch: (batchId, reason, lockVersion, key) => batchAction(`/batches/${segment(batchId)}/cancel`, key, { reason: reasonOf(reason), ...lockVersionPayload(lockVersion) }),
    executeItem: async (batchId, itemId, input, key) => toItem((await transport.post(funds(itemPath(batchId, itemId, 'execute')), apiItemResponse, key, executePayload(input, todayIso(now())))).data),
    failItem: async (batchId, itemId, reason, key) => toItem((await transport.post(funds(itemPath(batchId, itemId, 'fail')), apiItemResponse, key, { reason: reasonOf(reason) })).data),
    returnItem: async (batchId, itemId, reason, key) => toItem((await transport.post(funds(itemPath(batchId, itemId, 'return')), apiItemResponse, key, { reason: reasonOf(reason) })).data),
    withdrawFees: async (input, key) => toTransfer((await transport.post(funds('/trust/withdrawals'), apiTransferResponse, key, withdrawalPayload(input, todayIso(now())))).data),
    requestDeposit: async (input, key) => toDeposit((await transport.post(funds('/trust/deposits'), apiDepositResponse, key, depositPayload(input, todayIso(now())))).data),
    confirmDeposit: async (depositId, key) => toDeposit((await transport.post(funds(`/trust/deposits/${segment(depositId)}/confirm`), apiDepositResponse, key)).data),
    exportBatch: (batchId) => transport.csv(funds(`/batches/${segment(batchId)}/export`)),
    closeMonth: async (month, key) => {
      const response = await transport.post('/accounting/periods/close', apiCloseResponse, key, closePayload(month));
      return { period: toPeriod(response.data), warnings: response.warnings };
    },
    payoutRequests: async (query) => {
      const page = await transport.get(funds('/payout-account-requests'), apiPayoutRequestPage, { per_page: PAGE_SIZE, cursor: query.cursor, status: query.status, mandant: query.mandantId });
      return { items: page.data.map(toPayoutRequest), nextCursor: page.meta.next_cursor };
    },
    approvePayoutRequest: async (requestId, input) => toPayoutRequest((await transport.post(funds(`/payout-account-requests/${segment(requestId)}/approve`), apiPayoutRequestResponse, null, approveRequestPayload(input))).data),
    rejectPayoutRequest: async (requestId, lockVersion, reason) => toPayoutRequest((await transport.post(funds(`/payout-account-requests/${segment(requestId)}/reject`), apiPayoutRequestResponse, null, rejectRequestPayload(lockVersion, reason))).data),
    payoutProof: async (requestId) => {
      const blob = await transport.file(funds(`/payout-account-requests/${segment(requestId)}/proof`), PROOF_TYPES);
      const type = PROOF_TYPES.find((candidate) => blob.type.startsWith(candidate)) ?? 'application/pdf';
      return { blob, extension: PROOF_EXTENSIONS[type] };
    },
    confirmTwoFactor: createConfirmProof(client),
  };
}

import type { ApiClient } from '@eguardimmo/api';
import { z } from 'zod';
import { createConfirmProof } from '../../../reauth/proof';
import type { Currency } from '../../../../format/money';
import { bankingPermissions } from '../permissions';
import type { BankingSource } from '../source';
import { toAccount, toBookLine, toGap, toLine, toMatch, toPreview, toReconciliation, toStatement } from './bankingMapping';
import {
  acceptPayload,
  assertKey,
  createAccountPayload,
  ignorePayload,
  matchPayload,
  reasonOf,
  reconciliationForm,
  replaceAccountPayload,
  restorePayload,
  settlePayload,
  statementForm,
  updateAccountPayload,
} from './bankingPayloads';
import {
  apiAcceptResponse,
  apiAccountList,
  apiAccountResponse,
  apiAccountingBalances,
  apiBookLinePage,
  apiImportResponse,
  apiLinePage,
  apiLineResponse,
  apiMatchResponse,
  apiPreviewResponse,
  apiReconciliationPage,
  apiReconciliationResponse,
  apiStatementPage,
  apiStatementSchema,
  apiStatementShow,
} from './bankingSchemas';
import { createBankingTransport } from './bankingTransport';

export interface ApiBankingSourceOptions {
  client: ApiClient;
  organizationId: string | null;
  role: string | null;
}

export interface ApiBankingSourceDependencies {
  fetchImpl?: typeof fetch;
}

const PAGE_SIZE = 25;
const BOOK_PAGE_SIZE = 50;
const STATEMENT_TYPES = ['text/csv', 'text/plain', 'text/xml', 'application/xml', 'application/octet-stream'] as const;
const PROOF_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
const segment = (id: string): string => encodeURIComponent(id);
const apiStatementResponse = z.object({ data: apiStatementSchema });

export function createApiBankingSource({ client, organizationId, role }: ApiBankingSourceOptions, { fetchImpl }: ApiBankingSourceDependencies = {}): BankingSource {
  const transport = createBankingTransport(client, organizationId, fetchImpl);

  return {
    permissions: bankingPermissions(role),
    accounts: async () => (await transport.get('/accounts', apiAccountList)).data.map(toAccount),
    createAccount: async (input, key) => toAccount((await transport.post('/accounts', apiAccountResponse, { body: createAccountPayload(input), key: assertKey(key) })).data),
    replaceAccount: async (id, input, key) =>
      toAccount((await transport.post(`/accounts/${segment(id)}/replace`, apiAccountResponse, { body: replaceAccountPayload(input), key: assertKey(key) })).data),
    updateAccount: async (id, label, profile) => toAccount((await transport.patch(`/accounts/${segment(id)}`, apiAccountResponse, updateAccountPayload(label, profile))).data),
    closeAccount: async (id) => toAccount((await transport.post(`/accounts/${segment(id)}/close`, apiAccountResponse)).data),
    statements: async (accountId, cursor) => {
      const page = await transport.get('/statements', apiStatementPage, { per_page: PAGE_SIZE, cursor, account_id: accountId });
      return { items: page.data.map(toStatement), nextCursor: page.meta.next_cursor };
    },
    statement: async (id) => {
      const shown = await transport.get(`/statements/${segment(id)}`, apiStatementShow);
      return { statement: toStatement(shown.data), gaps: shown.meta.gaps.map(toGap) };
    },
    previewStatement: async (accountId, file, format, profile) =>
      toPreview((await transport.post(`/accounts/${segment(accountId)}/statements/preview`, apiPreviewResponse, { body: statementForm(file, format, profile) })).data),
    importStatement: async (accountId, file, format, profile, key) => {
      const response = await transport.post(`/accounts/${segment(accountId)}/statements`, apiImportResponse, { body: statementForm(file, format, profile), key: assertKey(key) });
      return { statement: toStatement(response.data), rejected: response.meta.rejected };
    },
    voidStatement: async (id, reason) => toStatement((await transport.post(`/statements/${segment(id)}/void`, apiStatementResponse, { body: { reason: reasonOf(reason) } })).data),
    downloadStatement: (id) => transport.blob(`/statements/${segment(id)}/file`, STATEMENT_TYPES),
    lines: async (query) => {
      const page = await transport.get('/lines', apiLinePage, {
        per_page: PAGE_SIZE,
        cursor: query.cursor,
        account_id: query.accountId,
        state: query.state,
        direction: query.direction,
        amount: query.amount,
        from: query.from,
        to: query.to,
      });
      return { items: page.data.map(toLine), nextCursor: page.meta.next_cursor };
    },
    bookLines: async (query) => {
      const page = await transport.get('/book-lines', apiBookLinePage, {
        limit: BOOK_PAGE_SIZE,
        cursor: query.cursor,
        account_id: query.accountId,
        side: query.side,
        amount: query.amount,
        from: query.from,
        to: query.to,
      });
      return { items: page.data.map(toBookLine), nextCursor: page.meta.next_cursor };
    },
    matchLine: async (lineId, otherLineIds, journalLineIds, lockVersion, key) =>
      toMatch((await transport.post(`/lines/${segment(lineId)}/match`, apiMatchResponse, { body: matchPayload(otherLineIds, journalLineIds, lockVersion), key: assertKey(key) })).data),
    settleLine: async (lineId, input, lockVersion, key) =>
      toMatch((await transport.post(`/lines/${segment(lineId)}/settle`, apiMatchResponse, { body: settlePayload(input, lockVersion), key: assertKey(key) })).data),
    ignoreLine: async (lineId, reason, pairLineId, lockVersion) =>
      toLine((await transport.post(`/lines/${segment(lineId)}/ignore`, apiLineResponse, { body: ignorePayload(reason, pairLineId, lockVersion) })).data),
    restoreLine: async (lineId, lockVersion) => toLine((await transport.post(`/lines/${segment(lineId)}/restore`, apiLineResponse, { body: restorePayload(lockVersion) })).data),
    acceptSuggestions: async (suggestionIds, key) => {
      const result = (await transport.post('/suggestions/accept', apiAcceptResponse, { body: acceptPayload(suggestionIds), key: assertKey(key) })).data;
      return {
        accepted: result.accepted.map((item) => ({ suggestionId: item.suggestion_id, matchId: item.match_id })),
        skipped: result.skipped.map((item) => ({ suggestionId: item.suggestion_id, reason: item.reason })),
        replayed: result.replayed,
      };
    },
    undoMatch: async (matchId, reason) => toMatch((await transport.post(`/matches/${segment(matchId)}/undo`, apiMatchResponse, { body: { reason: reasonOf(reason) } })).data),
    reconciliations: async (accountId, cursor) => {
      const page = await transport.get('/reconciliations', apiReconciliationPage, { per_page: PAGE_SIZE, cursor, account_id: accountId });
      return { items: page.data.map(toReconciliation), nextCursor: page.meta.next_cursor };
    },
    reconciliation: async (id) => toReconciliation((await transport.get(`/reconciliations/${segment(id)}`, apiReconciliationResponse)).data),
    buildReconciliation: async (input, key) =>
      toReconciliation((await transport.post('/reconciliations', apiReconciliationResponse, { body: reconciliationForm(input), key: assertKey(key) })).data),
    validateReconciliation: async (id, key) =>
      toReconciliation((await transport.post(`/reconciliations/${segment(id)}/validate`, apiReconciliationResponse, { key: assertKey(key) })).data),
    downloadProof: (id) => transport.blob(`/reconciliations/${segment(id)}/proof`, PROOF_TYPES),
    currency: async (): Promise<Currency | null> => {
      const accounts = (await transport.get('/accounts', apiAccountList)).data;
      const known = accounts[0]?.currency;
      if (known !== undefined) return known;
      const ledger = await transport.get('/accounting/accounts', apiAccountingBalances, undefined, 'organization');
      return ledger.data.flatMap((account) => account.balances)[0]?.currency ?? null;
    },
    confirmTwoFactor: createConfirmProof(client),
  };
}

import type { ApiClient } from "@eguardimmo/api";
import { createOrgTransport } from "@/features/org/transport";
import type { Page } from "@/features/org/schemas";
import { accountsResponse, entriesResponse, entryResponse, leasesResponse, statementResponse } from "./schemas";
import type { Account, EntryDetail, EntryFilters, EntrySummary, LeaseOption, LeaseStatement, StatementInput } from "./schemas";

export const ENTRIES_PER_PAGE = 50;
export const LEASES_PER_PAGE = 100;
export const LEASES_MAX_PAGES = 5;

export interface ComptabiliteSource {
  accounts: () => Promise<Account[]>;
  entries: (filters: EntryFilters, cursor: string | null) => Promise<Page<EntrySummary>>;
  entry: (id: string) => Promise<EntryDetail>;
  leases: () => Promise<LeaseOption[]>;
  statement: (input: StatementInput) => Promise<LeaseStatement>;
}

const MESSAGES: Readonly<Record<string, string>> = {
  entry_not_found: "Cette écriture n’existe pas ou n’appartient pas à votre organisation.",
  statement_too_long: "Ce relevé dépasse le nombre de lignes affichables : réduisez la période.",
};

export function createApiComptabiliteSource(options: { client: ApiClient; organizationId: string | null }): ComptabiliteSource {
  const transport = createOrgTransport(options.client, options.organizationId, { messages: MESSAGES });
  return {
    accounts: () => transport.get("/accounting/accounts", accountsResponse),
    entries: (filters, cursor) =>
      transport.get("/accounting/entries", entriesResponse, {
        per_page: ENTRIES_PER_PAGE,
        cursor,
        journal: filters.journal,
        lease: filters.lease,
        from: filters.from,
        to: filters.to,
      }),
    entry: (id) => transport.get(`/accounting/entries/${encodeURIComponent(id)}`, entryResponse),
    leases: async () => {
      const found: LeaseOption[] = [];
      let cursor: string | null = null;
      for (let pageIndex = 0; pageIndex < LEASES_MAX_PAGES; pageIndex += 1) {
        const page: Page<LeaseOption> = await transport.get("/leases", leasesResponse, { per_page: LEASES_PER_PAGE, cursor });
        found.push(...page.items);
        if (page.nextCursor === null) break;
        cursor = page.nextCursor;
      }
      return found;
    },
    statement: (input) =>
      transport.get(`/accounting/leases/${encodeURIComponent(input.lease)}/statement`, statementResponse, { currency: input.currency, from: input.from, to: input.to }),
  };
}

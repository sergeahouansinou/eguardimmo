import type { ApiClient } from '@eguardimmo/api';
import { OrgApiError } from '../../orgapi/errors';
import { createOrgTransport } from '../../orgapi/transport';
import type { TaxDataSource } from '../source';
import { translateTaxError } from './errors';
import { toGeneration, toSummary, toTaxIncome } from './mapping';
import { apiGeneration, apiMandantPage, apiRentalIncome, apiSummaryOne, apiSummaryPage } from './schemas';

export interface ApiTaxSourceOptions {
  client: ApiClient;
  organizationId: string | null;
}

const PDF = ['application/pdf'] as const;
const CSV = ['text/csv'] as const;
const MANDANT_PAGE = 100;
const MANDANT_PAGES_MAX = 20;
const segment = (id: string): string => encodeURIComponent(id);

export function createApiTaxSource({ client, organizationId }: ApiTaxSourceOptions, dependencies: { fetchImpl?: typeof fetch } = {}): TaxDataSource {
  const transport = createOrgTransport(client, organizationId, translateTaxError, dependencies.fetchImpl);
  const summaries = (path: string, query: { incomeYear: number | null; mandantId: string | null; cursor: string | null }) =>
    transport.get(path, apiSummaryPage, { income_year: query.incomeYear, mandant: query.mandantId, cursor: query.cursor }).then((page) => ({ items: page.data.map(toSummary), nextCursor: page.meta.next_cursor }));

  return {
    rentalIncome: async (year, householdComplete) => toTaxIncome((await transport.get(`/tax/rental-income/${String(year)}`, apiRentalIncome, { household_complete: householdComplete ? 1 : null })).data),
    summaries: (query) => summaries('/tax/summaries', query),
    summary: async (id) => toSummary((await transport.get(`/tax/summaries/${segment(id)}`, apiSummaryOne)).data),
    createSummary: async (input, key) => toSummary((await transport.post('/tax/summaries', apiSummaryOne, { body: { income_year: input.incomeYear, household_complete: input.householdComplete }, key })).data),
    rectifySummary: async (id, input, key) => toSummary((await transport.post(`/tax/summaries/${segment(id)}/rectify`, apiSummaryOne, { body: { reason: input.reason, lock_version: input.lockVersion }, key })).data),
    summaryPdf: (id) => transport.blob(`/tax/summaries/${segment(id)}/pdf`, PDF),
    summaryCsv: (id) => transport.blob(`/tax/summaries/${segment(id)}/lines.csv`, CSV),
    mandants: async () => {
      const all: { partyId: string; name: string }[] = [];
      let after: string | undefined;
      for (let page = 0; page < MANDANT_PAGES_MAX; page += 1) {
        const { data } = await transport.get('/mandates/mandants', apiMandantPage, { limit: MANDANT_PAGE, after });
        all.push(...data.map((mandant) => ({ partyId: mandant.party_id, name: mandant.display_name })));
        const last = data.at(-1);
        if (data.length < MANDANT_PAGE || last === undefined) return all;
        after = last.party_id;
      }
      return all;
    },
    statements: (query) => summaries('/tax/mandant-statements', query),
    statement: async (id) => toSummary((await transport.get(`/tax/mandant-statements/${segment(id)}`, apiSummaryOne)).data),
    generateStatements: async (input, key) => {
      try {
        return (await transport.post('/tax/mandant-statements', apiGeneration, { body: { income_year: input.incomeYear, mandant_ids: input.mandantIds }, key })).data.map(toGeneration);
      } catch (error) {
        const detail = error instanceof OrgApiError && error.kind !== 'unauthenticated' && error.kind !== 'forbidden' ? apiGeneration.safeParse({ data: error.extensions.data }) : null;
        if (detail?.success) return detail.data.data.map(toGeneration);
        throw error;
      }
    },
    publishStatement: async (id, lockVersion) => toSummary((await transport.post(`/tax/mandant-statements/${segment(id)}/publish`, apiSummaryOne, { body: { lock_version: lockVersion } })).data),
    rectifyStatement: async (id, input, key) => toSummary((await transport.post(`/tax/mandant-statements/${segment(id)}/rectify`, apiSummaryOne, { body: { reason: input.reason, lock_version: input.lockVersion }, key })).data),
    statementPdf: (id) => transport.blob(`/tax/mandant-statements/${segment(id)}/pdf`, PDF),
    statementCsv: (id) => transport.blob(`/tax/mandant-statements/${segment(id)}/lines.csv`, CSV),
  };
}

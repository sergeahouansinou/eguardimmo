import type { Query } from '@eguardimmo/api';
import { unsupported } from './apiErrors';
import { apiLeaseDetailResponseSchema, apiOccupancyResponseSchema, apiOrganizationResponseSchema, apiPartyPageSchema, apiPartyResponseSchema, apiTenanciesResponseSchema, apiTermListSchema, apiUnitPageSchema } from './apiSchemas';
import type { ApiLeaseDetail, ApiParty, ApiPartySummary, ApiTenancyLine, ApiUnitRef } from './apiSchemas';
import type { Transport } from './apiTransport';

export const PAGE_SIZE = 100;
export const MAX_PAGES = 50;
export const TENANCY_BATCH = 100;
export const OCCUPANCY_BATCH = 200;

export interface ApiContext {
  transport: Transport;
  latest: Map<string, ApiParty>;
  today: () => string;
}

export interface TenantPageQuery {
  search?: string;
  kind?: 'particulier' | 'societe';
  status?: 'active' | 'archived' | 'all';
  category?: string;
  cursor?: string;
  perPage?: number;
}

export const partyPath = (id: string): string => `/parties/${encodeURIComponent(id)}`;

export function remember(context: ApiContext, party: ApiParty): ApiParty {
  context.latest.set(party.id, party);
  return party;
}

export async function fetchParty(context: ApiContext, id: string): Promise<ApiParty> {
  const { data } = await context.transport.get(partyPath(id), apiPartyResponseSchema);
  return remember(context, data);
}

export async function knownParty(context: ApiContext, id: string): Promise<ApiParty> {
  return context.latest.get(id) ?? fetchParty(context, id);
}

export async function fetchSummaryPage(context: ApiContext, query: TenantPageQuery): Promise<{ items: ApiPartySummary[]; nextCursor: string | null }> {
  const params: Query = {
    per_page: query.perPage ?? PAGE_SIZE,
    cursor: query.cursor,
    q: query.search,
    category: query.category,
    kind: query.kind === undefined ? undefined : query.kind === 'societe' ? 'company' : 'person',
    status: query.status === undefined || query.status === 'active' ? undefined : query.status,
  };
  const page = await context.transport.get('/parties', apiPartyPageSchema, params);
  return { items: page.data, nextCursor: page.meta.next_cursor };
}

export async function fetchTenancies(context: ApiContext, ids: readonly string[]): Promise<Map<string, ApiTenancyLine[]>> {
  const lines = new Map<string, ApiTenancyLine[]>();
  for (let start = 0; start < ids.length; start += TENANCY_BATCH) {
    const batch = ids.slice(start, start + TENANCY_BATCH);
    const { data } = await context.transport.get(
      '/leases/tenancies',
      apiTenanciesResponseSchema,
      Object.fromEntries(batch.map((id, index) => [`parties[${String(index)}]`, id])),
    );
    for (const entry of data) lines.set(entry.party.id, entry.leases);
  }
  return lines;
}

export async function fetchLeaseDetail(context: ApiContext, leaseId: string): Promise<ApiLeaseDetail> {
  const { data } = await context.transport.get(`/leases/${encodeURIComponent(leaseId)}`, apiLeaseDetailResponseSchema);
  return data;
}

export async function fetchAllSummaries(context: ApiContext, query: TenantPageQuery): Promise<ApiPartySummary[]> {
  const all: ApiPartySummary[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { items, nextCursor } = await fetchSummaryPage(context, { ...query, cursor, perPage: PAGE_SIZE });
    all.push(...items);
    if (nextCursor === null) return all;
    cursor = nextCursor;
  }
  throw unsupported('Trop de locataires pour un chargement complet : affinez la recherche.');
}

export async function fetchAllUnits(context: ApiContext): Promise<ApiUnitRef[]> {
  const all: ApiUnitRef[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await context.transport.get('/units', apiUnitPageSchema, { per_page: PAGE_SIZE, cursor });
    all.push(...result.data);
    if (result.meta.next_cursor === null) return all;
    cursor = result.meta.next_cursor;
  }
  throw unsupported('Trop de lots pour un chargement complet.');
}

export async function fetchVacancy(context: ApiContext, unitIds: readonly string[]): Promise<Map<string, boolean>> {
  const vacancy = new Map<string, boolean>();
  for (let start = 0; start < unitIds.length; start += OCCUPANCY_BATCH) {
    const batch = unitIds.slice(start, start + OCCUPANCY_BATCH);
    const { data } = await context.transport.get('/leases/occupancy', apiOccupancyResponseSchema, {
      ...Object.fromEntries(batch.map((id, index) => [`units[${String(index)}]`, id])),
      date: context.today(),
    });
    for (const entry of data) vacancy.set(entry.unit.id, entry.vacant);
  }
  return vacancy;
}

export async function fetchContactIds(context: ApiContext): Promise<Set<string>> {
  const { data: terms } = await context.transport.get('/catalog/vocabularies/contact_category/terms', apiTermListSchema);
  const groups = await Promise.all(terms.map((term) => fetchAllSummaries(context, { status: 'all', category: term.id })));
  return new Set(groups.flat().map((party) => party.id));
}

export async function fetchOrganizationCountry(context: ApiContext): Promise<string> {
  const { data } = await context.transport.get('', apiOrganizationResponseSchema);
  return data.country;
}

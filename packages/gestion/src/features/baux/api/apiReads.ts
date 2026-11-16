import type { LeaseStatus } from '../schemas';
import { unsupported } from './apiErrors';
import { PHASE_BY_STATUS } from './apiMapping';
import { apiLeasePageSchema, apiLeaseResponseSchema } from './apiSchemas';
import type { ApiLease, ApiLeaseSummary } from './apiSchemas';
import type { Transport } from './apiTransport';

export const PAGE_SIZE = 100;
export const MAX_PAGES = 50;
export const DETAIL_CONCURRENCY = 6;

export interface ApiContext {
  transport: Transport;
  latest: Map<string, ApiLease>;
  today: () => string;
}

export interface LeasePageQuery {
  status?: LeaseStatus;
  unitId?: string;
  partyId?: string;
  archived?: boolean;
  search?: string;
  cursor?: string;
  perPage?: number;
}

export const leasePath = (id: string): string => `/leases/${encodeURIComponent(id)}`;

export function remember(context: ApiContext, lease: ApiLease): ApiLease {
  context.latest.set(lease.id, lease);
  return lease;
}

export async function fetchLease(context: ApiContext, id: string): Promise<ApiLease> {
  const { data } = await context.transport.get(leasePath(id), apiLeaseResponseSchema);
  return remember(context, data);
}

export async function knownLease(context: ApiContext, id: string): Promise<ApiLease> {
  return context.latest.get(id) ?? fetchLease(context, id);
}

export async function fetchSummaries(context: ApiContext, query: LeasePageQuery): Promise<{ items: ApiLeaseSummary[]; nextCursor: string | null }> {
  const page = await context.transport.get('/leases', apiLeasePageSchema, {
    per_page: query.perPage ?? PAGE_SIZE,
    cursor: query.cursor,
    phase: query.status === undefined ? undefined : PHASE_BY_STATUS[query.status],
    unit: query.unitId,
    party: query.partyId,
    archived: query.archived === true ? 1 : undefined,
    q: query.search,
  });
  return { items: page.data, nextCursor: page.meta.next_cursor };
}

export async function mapLimit<T, R>(items: readonly T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next;
      next += 1;
      const item = items[index];
      if (item !== undefined) results[index] = await task(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function fetchAllSummaries(context: ApiContext, query: LeasePageQuery): Promise<ApiLeaseSummary[]> {
  const all: ApiLeaseSummary[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { items, nextCursor } = await fetchSummaries(context, { ...query, cursor, perPage: PAGE_SIZE });
    all.push(...items);
    if (nextCursor === null) return all;
    cursor = nextCursor;
  }
  throw unsupported('Trop de baux pour un chargement complet : affinez la recherche.');
}

export async function fetchAllLeases(context: ApiContext): Promise<ApiLease[]> {
  const [active, archived] = await Promise.all([fetchAllSummaries(context, {}), fetchAllSummaries(context, { archived: true })]);
  return mapLimit([...active, ...archived], DETAIL_CONCURRENCY, (summary) => fetchLease(context, summary.id));
}

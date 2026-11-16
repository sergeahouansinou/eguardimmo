import { unsupported } from './apiErrors';
import { apiLeaseDetailResponseSchema, apiLeasePageSchema, apiOccupancyResponseSchema, apiOwnershipsResponseSchema, apiPropertyPageSchema, apiPropertyResponseSchema, apiUnitPageSchema, apiUnitResponseSchema } from './apiSchemas';
import type { ApiLeaseDetail, ApiOccupancy, ApiOwnership, ApiProperty, ApiPropertySummary, ApiUnit } from './apiSchemas';
import type { Transport } from './apiTransport';

export const PAGE_SIZE = 100;
export const MAX_PAGES = 50;
export const DETAIL_CONCURRENCY = 4;
const OCCUPANCY_CHUNK = 100;

export type ListStatus = 'active' | 'archived' | 'all';

export interface ApiContext {
  transport: Transport;
  units: Map<string, ApiUnit>;
  properties: Map<string, ApiProperty>;
  today: () => string;
}

export interface UnitPageQuery {
  search?: string;
  propertyId?: string;
  unitTypeId?: string;
  parentId?: string;
  rootOnly?: boolean;
  status?: ListStatus;
  cursor?: string;
  perPage?: number;
}

export interface PropertyPageQuery {
  search?: string;
  type?: 'building' | 'house' | 'complex';
  status?: ListStatus;
  cursor?: string;
  perPage?: number;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export const unitPath = (id: string): string => `/units/${encodeURIComponent(id)}`;
export const propertyPath = (id: string): string => `/properties/${encodeURIComponent(id)}`;

export function forget(context: ApiContext, kind: 'unit' | 'property', id: string): void {
  (kind === 'unit' ? context.units : context.properties).delete(id);
}

export async function fetchUnit(context: ApiContext, id: string): Promise<ApiUnit> {
  const { data } = await context.transport.get(unitPath(id), apiUnitResponseSchema);
  context.units.set(data.id, data);
  return data;
}

export const knownUnit = async (context: ApiContext, id: string): Promise<ApiUnit> => context.units.get(id) ?? fetchUnit(context, id);

export async function fetchProperty(context: ApiContext, id: string): Promise<ApiProperty> {
  const { data } = await context.transport.get(propertyPath(id), apiPropertyResponseSchema);
  context.properties.set(data.id, data);
  return data;
}

export const knownProperty = async (context: ApiContext, id: string): Promise<ApiProperty> => context.properties.get(id) ?? fetchProperty(context, id);

export async function fetchUnitPage(context: ApiContext, query: UnitPageQuery): Promise<Page<ApiUnit>> {
  const page = await context.transport.get('/units', apiUnitPageSchema, {
    per_page: query.perPage ?? PAGE_SIZE,
    cursor: query.cursor,
    q: query.search,
    property: query.propertyId,
    unit_type: query.unitTypeId,
    parent: query.parentId,
    root: query.rootOnly === true ? 1 : undefined,
    status: query.status,
  });
  page.data.forEach((unit) => context.units.set(unit.id, unit));
  return { items: page.data, nextCursor: page.meta.next_cursor };
}

export async function fetchPropertyPage(context: ApiContext, query: PropertyPageQuery): Promise<Page<ApiPropertySummary>> {
  const page = await context.transport.get('/properties', apiPropertyPageSchema, {
    per_page: query.perPage ?? PAGE_SIZE,
    cursor: query.cursor,
    q: query.search,
    type: query.type,
    status: query.status,
  });
  return { items: page.data, nextCursor: page.meta.next_cursor };
}

async function drain<T>(load: (cursor: string | undefined) => Promise<Page<T>>, what: string): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { items, nextCursor } = await load(cursor);
    all.push(...items);
    if (nextCursor === null) return all;
    cursor = nextCursor;
  }
  throw unsupported(`Trop de ${what} pour un chargement complet : affinez la recherche.`);
}

export const fetchAllUnits = (context: ApiContext, status: ListStatus = 'all'): Promise<ApiUnit[]> => drain((cursor) => fetchUnitPage(context, { status, cursor }), 'lots');
export const fetchAllProperties = (context: ApiContext, status: ListStatus = 'all'): Promise<ApiPropertySummary[]> => drain((cursor) => fetchPropertyPage(context, { status, cursor }), 'immeubles');

export async function fetchOccupancy(context: ApiContext, unitIds: readonly string[]): Promise<Map<string, ApiOccupancy>> {
  const result = new Map<string, ApiOccupancy>();
  for (let start = 0; start < unitIds.length; start += OCCUPANCY_CHUNK) {
    const chunk = unitIds.slice(start, start + OCCUPANCY_CHUNK);
    const { data } = await context.transport.get('/leases/occupancy', apiOccupancyResponseSchema, Object.fromEntries(chunk.map((unitId, index) => [`units[${String(index)}]`, unitId])));
    data.forEach((entry) => result.set(entry.unit.id, entry));
  }
  return result;
}

export async function fetchOwnerships(context: ApiContext, unitId: string, at?: string): Promise<ApiOwnership[]> {
  const { data } = await context.transport.get(`${unitPath(unitId)}/ownerships`, apiOwnershipsResponseSchema, { at });
  return data;
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

export async function fetchUnitLeases(context: ApiContext, unitId: string): Promise<ApiLeaseDetail[]> {
  const listing = (archived: boolean) =>
    drain(
      async (cursor) => {
        const page = await context.transport.get('/leases', apiLeasePageSchema, { per_page: PAGE_SIZE, cursor, unit: unitId, archived: archived ? 1 : undefined });
        return { items: page.data, nextCursor: page.meta.next_cursor };
      },
      'baux',
    );
  const [active, archived] = await Promise.all([listing(false), listing(true)]);
  return mapLimit([...active, ...archived], DETAIL_CONCURRENCY, async (summary) => (await context.transport.get(`/leases/${encodeURIComponent(summary.id)}`, apiLeaseDetailResponseSchema)).data);
}

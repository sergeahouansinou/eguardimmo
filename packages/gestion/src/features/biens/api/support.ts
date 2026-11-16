import { createApiBiensSource } from './apiSource';
import * as api from './responses.fixtures';
import { mockApi, orgPath } from './testing';
import type { MockRoute } from './testing';

export const NOW = new Date('2026-11-16T10:00:00Z');
export const org = (path: string): string => orgPath(api.IDS.org, path);

export function setup(routes: Record<string, MockRoute>, organizationId: string | null = api.IDS.org) {
  const mock = mockApi(routes);
  const source = createApiBiensSource({ client: mock.client, organizationId }, { now: () => NOW });
  return { source, ...mock };
}

export const readRoutes = (): Record<string, MockRoute> => ({
  [`GET ${org('/units')}`]: (call) =>
    call.search.get('cursor') === 'page2'
      ? { body: api.pageOf('/units', [api.unitArchived, api.unitVacant]) }
      : { body: api.pageOf('/units', [api.unitSummary, api.unitNotice], 'page2') },
  [`GET ${org('/leases/occupancy')}`]: { body: api.occupancyResponse },
  [`GET ${org(`/properties/${api.IDS.property}`)}`]: { body: api.detail(api.propertyDetail) },
  [`GET ${org('/properties')}`]: (call) =>
    call.search.get('cursor') === 'p2' ? { body: api.pageOf('/properties', [api.propertyArchivedSummary]) } : { body: api.pageOf('/properties', [api.propertySummary, api.propertyBjSummary], 'p2') },
  [`GET ${org(`/units/${api.IDS.unit}`)}`]: { body: api.detail(api.unitDetail) },
  [`GET ${org('/catalog/vocabularies/unit_type/terms')}`]: { body: api.unitTypeTerms },
});

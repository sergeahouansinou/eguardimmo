import { mockApi, orgPath } from '../../baux/api/testing';
import type { MockRoute } from '../../baux/api/testing';
import { createApiLocatairesSource } from './apiSource';
import * as api from './responses.fixtures';

export { mockApi };
export type { MockRoute };

export const NOW = new Date('2026-11-16T10:00:00Z');
export const org = (path: string): string => orgPath(api.IDS.org, path);
export const party = (id: string): string => org(`/parties/${id}`);

const KNOWN: Record<string, Record<string, unknown>> = {
  [api.IDS.awa]: api.awaSummary,
  [api.IDS.societe]: api.societeSummary,
  [api.IDS.marc]: api.marcSummary,
  [api.IDS.nina]: api.ninaSummary,
  [api.IDS.garant]: api.garantSummary,
  [api.IDS.lea]: api.leaSummary,
};

export function tenanciesRoute(linesByParty: Record<string, readonly Record<string, unknown>[]>): MockRoute {
  return (call) => ({
    body: api.tenanciesResponse(
      [...call.search.entries()]
        .filter(([key]) => key.startsWith('parties['))
        .map(([, id]) => api.tenancyEntry(KNOWN[id] ?? api.summary(id, 'Inconnu'), linesByParty[id] ?? [])),
    ),
  });
}

export const defaultLines = {
  [api.IDS.awa]: [api.line()],
  [api.IDS.garant]: [api.line({ id: api.IDS.leaseGuarantee, role: 'guarantor' })],
  [api.IDS.marc]: [api.line({ id: api.IDS.leaseOld, reference: 'BL-2025-0009', phase: 'notice' })],
  [api.IDS.nina]: [api.line({ id: api.IDS.leaseOld, phase: 'ended', end_date: '2026-06-30' })],
};

export function listRoutes(): Record<string, MockRoute> {
  return {
    [`GET ${org('/parties')}`]: (call) => {
      if (call.search.get('category') === api.IDS.contactCategory) return { body: api.pageOf([api.societeSummary]) };
      return call.search.get('cursor') === 'page2' ? { body: api.pageOf([api.ninaSummary, api.marcSummary, api.leaSummary]) } : { body: api.pageOf([api.awaSummary, api.societeSummary, api.garantSummary], 'page2') };
    },
    [`GET ${org('/catalog/vocabularies/contact_category/terms')}`]: { body: api.contactCategoriesResponse },
    [`GET ${org('')}`]: { body: api.organizationResponse },
    [`GET ${org('/leases/tenancies')}`]: tenanciesRoute(defaultLines),
    [`GET ${party(api.IDS.awa)}`]: { body: api.detailResponse(api.awaDetail) },
    [`GET ${org(`/leases/${api.IDS.lease}`)}`]: { body: api.detailResponse(api.leaseDetail) },
    [`GET ${org('/units')}`]: { body: api.unitsPage([api.unitSummary(api.IDS.unit, 'A12'), api.unitSummary(api.IDS.annex, 'B3')]) },
    [`GET ${org('/leases/occupancy')}`]: { body: api.occupancyResponse },
  };
}

export function setup(routes: Record<string, MockRoute>, organizationId: string | null = api.IDS.org) {
  const mock = mockApi(routes);
  const source = createApiLocatairesSource({ client: mock.client, organizationId }, { now: () => NOW });
  return { source, ...mock };
}

import type { ReactElement } from 'react';
import { mockOrgApi, orgInfoStub, orgPath, renderWithOrg } from '../orgapi/testing';
import type { MockRoute } from '../orgapi/testing';
import type { OrgKind, OrgRole } from '../orgapi/model';
import { IDS } from './api/fixtures';
import { createApiAnalyticsSource } from './api/source';
import { AnalyticsSourceProvider } from './source';

export { problem } from '../orgapi/testing';
export const reportingUrl = (path = ''): string => orgPath(IDS.org, `/reporting${path}`);

export function renderAnalytics(ui: ReactElement, routes: Record<string, MockRoute>, { role = 'owner', kind = 'individual' }: { role?: OrgRole; kind?: OrgKind } = {}) {
  const mock = mockOrgApi(routes);
  const source = createApiAnalyticsSource({ client: mock.client, organizationId: IDS.org }, { fetchImpl: mock.fetchImpl });
  const view = renderWithOrg(ui, {
    info: orgInfoStub({ role, kind }),
    providers: (children) => <AnalyticsSourceProvider source={source}>{children}</AnalyticsSourceProvider>,
  });
  return { ...view, ...mock };
}

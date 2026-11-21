import type { ReactElement } from 'react';
import { createApiInvestmentsSource } from './api/source';
import { IDS, organization } from './api/fixtures';
import { orgInfoStub, orgPath, renderWithOrg, mockOrgApi } from '../orgapi/testing';
import type { MockRoute } from '../orgapi/testing';
import type { OrgRole } from '../orgapi/model';
import { InvestmentsSourceProvider } from './source';

export { problem } from '../orgapi/testing';
export const investmentsUrl = (path = ''): string => orgPath(IDS.org, `/investments${path}`);
export const organizationUrl = orgPath(IDS.org, '');

export function renderInvestments(ui: ReactElement, routes: Record<string, MockRoute>, { role = 'owner', kind = 'individual' }: { role?: OrgRole; kind?: 'agency' | 'individual' } = {}) {
  const mock = mockOrgApi({ [`GET ${organizationUrl}`]: { body: organization }, ...routes });
  const source = createApiInvestmentsSource({ client: mock.client, organizationId: IDS.org }, { fetchImpl: mock.fetchImpl });
  const view = renderWithOrg(ui, {
    info: orgInfoStub({ role, kind }),
    providers: (children) => <InvestmentsSourceProvider source={source}>{children}</InvestmentsSourceProvider>,
  });
  return { ...view, ...mock };
}

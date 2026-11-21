import type { ReactElement } from 'react';
import { createApiTaxSource } from './api/source';
import { IDS } from './api/fixtures';
import { mockOrgApi, orgInfoStub, orgPath, renderWithOrg } from '../orgapi/testing';
import type { MockRoute } from '../orgapi/testing';
import type { OrgKind, OrgRole } from '../orgapi/model';
import { TaxSourceProvider } from './source';

export { problem } from '../orgapi/testing';
export const taxUrl = (path = ''): string => orgPath(IDS.org, `/tax${path}`);

export function renderTax(ui: ReactElement, routes: Record<string, MockRoute>, { role = 'owner', kind = 'individual' }: { role?: OrgRole; kind?: OrgKind } = {}) {
  const mock = mockOrgApi(routes);
  const source = createApiTaxSource({ client: mock.client, organizationId: IDS.org }, { fetchImpl: mock.fetchImpl });
  const view = renderWithOrg(ui, {
    info: orgInfoStub({ role, kind }),
    providers: (children) => <TaxSourceProvider source={source}>{children}</TaxSourceProvider>,
  });
  return { ...view, ...mock };
}

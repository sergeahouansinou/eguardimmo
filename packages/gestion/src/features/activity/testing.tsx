import type { ReactElement } from 'react';
import { createApiActivitySource } from './api/source';
import { IDS } from './api/fixtures';
import { mockOrgApi, orgPath } from './api/testing';
import type { MockRoute } from './api/testing';
import { orgInfoStub, renderWithOrg } from '../orgapi/testing';
import type { OrgInfoSource } from '../orgapi/source';
import type { OrgRole } from '../orgapi/model';
import { ActivitySourceProvider } from './source';

export { problem } from '../orgapi/testing';
export const activityUrl = (path = ''): string => orgPath(IDS.org, `/activity${path}`);

export interface RenderActivityOptions {
  role?: OrgRole;
  search?: string;
  timezone?: string;
  info?: Partial<Omit<OrgInfoSource, 'role' | 'kind' | 'timezone'>>;
}

export function renderActivity(ui: ReactElement, routes: Record<string, MockRoute>, { role = 'owner', search = '', timezone = 'Europe/Paris', info = {} }: RenderActivityOptions = {}) {
  const mock = mockOrgApi(routes);
  const source = createApiActivitySource({ client: mock.client, organizationId: IDS.org }, { fetchImpl: mock.fetchImpl });
  const view = renderWithOrg(ui, {
    info: { ...orgInfoStub({ role, ...info }), timezone: () => Promise.resolve(timezone) },
    search,
    providers: (children) => <ActivitySourceProvider source={source}>{children}</ActivitySourceProvider>,
  });
  return { ...view, ...mock };
}

export const twice = (first: MockRoute, then: MockRoute): MockRoute => {
  let count = 0;
  return (call) => {
    count += 1;
    const route = count === 1 ? first : then;
    return typeof route === 'function' ? route(call) : route;
  };
};

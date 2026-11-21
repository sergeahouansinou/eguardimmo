import type { ReactElement } from 'react';
import { TEST_ORG, orgInfoStub, problem, renderWithOrg } from '../../orgapi/testing';
import type { OrgRole } from '../../orgapi';
import { createApiPlanningSource } from '../api/source';
import { mockPlanningApi, orgPath } from '../api/testing';
import type { MockRoute } from '../api/testing';
import { PlanningSourceProvider } from '../source';

export { problem };
export const planningUrl = (path: string): string => orgPath(TEST_ORG, `/planning${path}`);

export function renderTasks(ui: ReactElement, routes: Record<string, MockRoute>, { role = 'owner', timezone = 'Europe/Paris', search = '' }: { role?: OrgRole; timezone?: string; search?: string } = {}) {
  const mock = mockPlanningApi(routes);
  const source = createApiPlanningSource({ client: mock.client, organizationId: TEST_ORG }, { fetchImpl: mock.fetchImpl });
  const view = renderWithOrg(ui, {
    info: { ...orgInfoStub({ role }), timezone: () => Promise.resolve(timezone) },
    search,
    providers: (children) => <PlanningSourceProvider source={source}>{children}</PlanningSourceProvider>,
  });
  return { ...view, ...mock };
}

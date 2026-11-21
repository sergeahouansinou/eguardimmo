import type { ReactElement } from 'react';
import { createApiDirectorySource } from './api/source';
import { TEST_ORG, mockOrgApi, orgPath, problem, renderWithOrg, orgInfoStub } from '../orgapi/testing';
import type { MockRoute } from '../orgapi/testing';
import type { OrgInfoSource } from '../orgapi/source';
import type { OrgKind, OrgRole } from '../orgapi/model';
import { DirectorySourceProvider } from './source';
import { FIXTURE_CATEGORY, FIXTURE_TAG, categoryTermFixture, cursorPageFixture, tagFixture } from './api/fixtures';

export { problem, TEST_ORG };
export const dirUrl = (path: string): string => orgPath(TEST_ORG, path);

export const choiceRoutes = (): Record<string, MockRoute> => ({
  [`GET ${dirUrl('/catalog/vocabularies/contact_category/terms')}`]: { body: { data: [categoryTermFixture(), categoryTermFixture({ id: '0198a0a0-0000-7000-8000-0000000000d2', key: 'syndic', labels: { fr: 'Syndic' }, semantic_key: 'syndic' })] } },
  [`GET ${dirUrl('/catalog/tags')}`]: { body: cursorPageFixture([tagFixture(), tagFixture({ id: '0198a0a0-0000-7000-8000-0000000000e2', name: 'Électricité', slug: 'electricite' })]) },
});

export interface RenderDirectoryOptions {
  role?: OrgRole;
  kind?: OrgKind;
  search?: string;
  info?: Partial<Omit<OrgInfoSource, 'role' | 'kind' | 'timezone'>>;
}

export function renderDirectory(ui: ReactElement, routes: Record<string, MockRoute>, { role = 'owner', kind = 'agency', search = '', info = {} }: RenderDirectoryOptions = {}) {
  const mock = mockOrgApi({ ...choiceRoutes(), ...routes });
  const source = createApiDirectorySource({ client: mock.client, organizationId: TEST_ORG, role, kind }, { fetchImpl: mock.fetchImpl });
  const view = renderWithOrg(ui, { info: orgInfoStub({ role, kind, ...info }), search, providers: (children) => <DirectorySourceProvider source={source}>{children}</DirectorySourceProvider> });
  return { ...view, ...mock };
}

export { FIXTURE_CATEGORY, FIXTURE_TAG };

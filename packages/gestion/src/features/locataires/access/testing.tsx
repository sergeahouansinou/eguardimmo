import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ComponentProps, ReactElement } from 'react';
import { vi } from 'vitest';
import { ToastProvider, TooltipProvider } from '@eguardimmo/ui';
import { GestionNavigationProvider } from '../kit';
import { createApiTenantAccessSource } from './api/accessSource';
import { mockAccessApi } from './api/testing';
import type { MockRoute } from './api/testing';
import { IDS } from './api/responses.fixtures';
import type { TenantAccessRole } from './model';
import { TenantAccessSourceProvider } from './source';

function TestLink({ href, children, ...props }: ComponentProps<'a'> & { href: string }) {
  return <a href={href} {...props}>{children}</a>;
}

export function renderAccess(ui: ReactElement, routes: Record<string, MockRoute>, { role = 'manager' }: { role?: TenantAccessRole | null } = {}) {
  const mock = mockAccessApi(routes);
  const source = createApiTenantAccessSource({ client: mock.client, organizationId: IDS.org, role });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ToastProvider>
          <GestionNavigationProvider value={{ Link: TestLink, push: vi.fn<(href: string) => void>(), search: new URLSearchParams() }}>
            <TenantAccessSourceProvider source={source}>{ui}</TenantAccessSourceProvider>
          </GestionNavigationProvider>
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return { ...view, ...mock };
}

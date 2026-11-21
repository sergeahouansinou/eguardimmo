import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ComponentProps, ReactElement } from 'react';
import { vi } from 'vitest';
import { ToastProvider, TooltipProvider } from '@eguardimmo/ui';
import { GestionNavigationProvider } from '../../locataires/kit';
import { createApiLegalIdentitySource } from './api/legalSource';
import { ORG } from './api/responses.fixtures';
import { mockLegalApi } from './api/testing';
import type { LegalRole } from './model';
import { LegalIdentitySourceProvider } from './source';

function TestLink({ href, children, ...props }: ComponentProps<'a'> & { href: string }) {
  return <a href={href} {...props}>{children}</a>;
}

export function renderLegal(ui: ReactElement, routes: Parameters<typeof mockLegalApi>[0], { role = 'owner' }: { role?: LegalRole | null } = {}) {
  const mock = mockLegalApi(routes);
  const source = createApiLegalIdentitySource({ client: mock.client, organizationId: ORG, role });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ToastProvider>
          <GestionNavigationProvider value={{ Link: TestLink, push: vi.fn<(href: string) => void>(), search: new URLSearchParams() }}>
            <LegalIdentitySourceProvider source={source}>{ui}</LegalIdentitySourceProvider>
          </GestionNavigationProvider>
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return { ...view, ...mock };
}

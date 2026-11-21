import { createApiClient } from '@eguardimmo/api';
import { MessagerieProvider, consoleProfile, createApiMessagerieSource } from '@eguardimmo/messagerie';
import { ToastProvider, TooltipProvider } from '@eguardimmo/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { messagerieRoutes } from '@/espace/messagerie';
import { expectNoA11yViolations } from '../../../test/axe';
import HelpRoute from './aide/page';

function Anchor({ children, ...props }: ComponentProps<'a'> & { href: string }) {
  return <a {...props}>{children}</a>;
}

describe('page Aide en mode api', () => {
  it('reste l’écran d’aide commun avec la source API, sans appeler le réseau', async () => {
    const network = vi.fn<typeof fetch>(() => Promise.reject(new Error('aucun appel réseau attendu')));
    const client = createApiClient({ baseUrl: window.location.origin, fetchImpl: network, readCookie: () => 'x' });
    const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={queries}>
        <TooltipProvider>
          <ToastProvider>
            <MessagerieProvider source={createApiMessagerieSource({ client, organizationId: null, space: 'console' })} profile={consoleProfile} routes={messagerieRoutes} Link={Anchor} navigate={() => undefined}>
              <HelpRoute />
            </MessagerieProvider>
          </ToastProvider>
        </TooltipProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { level: 1 })).toBeTruthy();
    expect(network).not.toHaveBeenCalled();
    await expectNoA11yViolations(container);
  });
});

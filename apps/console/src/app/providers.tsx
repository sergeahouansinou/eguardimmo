'use client';

import { createApiClient } from '@eguardimmo/api';
import type { ApiClient } from '@eguardimmo/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConsoleSupportProvider, MessagerieProvider, consoleProfile, createApiMessagerieSource, createConsoleSupportApiSource, createDemoMessagerieSource } from '@eguardimmo/messagerie';
import type { ConsoleSupportSource, MessagerieSource } from '@eguardimmo/messagerie';
import { ToastProvider, TooltipProvider } from '@eguardimmo/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ProofDialogHost } from '@/features/proof/ProofDialog';
import { createPlatformApi } from '@/platform/api';
import type { PlatformApi } from '@/platform/api';
import { PlatformApiProvider } from '@/platform/context';
import { createProofBroker, createProofFetch } from '@/platform/proof';
import type { ProofBroker } from '@/platform/proof';
import { createApiAuth } from '@/console/api/auth';
import { consoleOrigin } from '@/console/api/origin';
import { createApiConsoleSource } from '@/console/api/source';
import { createDemoSource } from '@/console/demo/source';
import { ConsoleSourceProvider } from '@/console/source';
import type { ConsoleSource } from '@/console/source';
import { messagerieRoutes } from '@/espace/messagerie';
import { dataSource } from '@/lib/env';

const LOGIN_PATH = '/connexion';

function createRelayFetch(onUnauthorized: () => void): typeof fetch {
  return async (...args) => {
    const response = await fetch(...args);
    if (response.status === 401 && window.location.pathname !== LOGIN_PATH) onUnauthorized();
    return response;
  };
}

const consoleSupportRoutes = { board: '/support', ticket: (id: string) => `/support/${id}` };

interface Sources {
  source: ConsoleSource;
  messagerie: MessagerieSource;
  support: ConsoleSupportSource | null;
  platform: PlatformApi | null;
  broker: ProofBroker | null;
}

function createSources(onUnauthorized: () => void): Sources {
  if (dataSource === 'demo') {
    return { source: createDemoSource(), messagerie: createDemoMessagerieSource({ space: 'console' }), support: null, platform: null, broker: null };
  }
  const broker = createProofBroker();
  const fetchImpl = createProofFetch(createRelayFetch(onUnauthorized), broker);
  const client: ApiClient = createApiClient({ baseUrl: consoleOrigin(), fetchImpl });
  const { source, operatorId } = createApiConsoleSource(client, createApiAuth(client));
  return {
    source,
    messagerie: createApiMessagerieSource({ client, organizationId: null, space: 'console' }),
    support: createConsoleSupportApiSource({ client, operatorId, fetchImpl }),
    platform: createPlatformApi(client),
    broker,
  };
}

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, ...(dataSource === 'api' ? { retry: 1 } : {}) } } }));
  const [{ source, messagerie, support, platform, broker }] = useState(() => createSources(() => { router.replace(LOGIN_PATH); }));
  const content = support ? (
    <ConsoleSupportProvider source={support} routes={consoleSupportRoutes} Link={Link} navigate={(href) => { router.push(href); }}>
      {children}
    </ConsoleSupportProvider>
  ) : (
    children
  );
  return (
    <QueryClientProvider client={client}>
      <ConsoleSourceProvider source={source}>
        <MessagerieProvider
          source={messagerie}
          profile={consoleProfile}
          routes={messagerieRoutes}
          Link={Link}
          navigate={(href) => { router.push(href); }}
        >
          <TooltipProvider>
            <ToastProvider>
              {platform && broker ? (
                <PlatformApiProvider api={platform}>
                  {content}
                  <ProofDialogHost broker={broker} />
                </PlatformApiProvider>
              ) : (
                content
              )}
            </ToastProvider>
          </TooltipProvider>
        </MessagerieProvider>
      </ConsoleSourceProvider>
    </QueryClientProvider>
  );
}

'use client';

import { createApiClient } from '@eguardimmo/api';
import type { ApiClient } from '@eguardimmo/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MessagerieProvider, consoleProfile, createApiMessagerieSource, createDemoMessagerieSource } from '@eguardimmo/messagerie';
import type { MessagerieSource } from '@eguardimmo/messagerie';
import { ToastProvider, TooltipProvider } from '@eguardimmo/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { createApiAuth } from '@/console/api/auth';
import { consoleOrigin } from '@/console/api/origin';
import { createDemoSource } from '@/console/demo/source';
import { ConsoleSourceProvider } from '@/console/source';
import type { ConsoleSource } from '@/console/source';
import { messagerieRoutes } from '@/espace/messagerie';
import { env } from '@/lib/env';

const LOGIN_PATH = '/connexion';

function createConsoleApiClient(onUnauthorized: () => void): ApiClient {
  return createApiClient({
    baseUrl: consoleOrigin(),
    fetchImpl: async (...args) => {
      const response = await fetch(...args);
      if (response.status === 401 && window.location.pathname !== LOGIN_PATH) onUnauthorized();
      return response;
    },
  });
}

function createSources(onUnauthorized: () => void): { source: ConsoleSource; messagerie: MessagerieSource } {
  const demo = createDemoSource();
  if (env.NEXT_PUBLIC_DATA_SOURCE === 'demo') {
    return { source: demo, messagerie: createDemoMessagerieSource({ space: 'console' }) };
  }
  return {
    source: { ...demo, auth: createApiAuth() },
    messagerie: createApiMessagerieSource({ client: createConsoleApiClient(onUnauthorized), organizationId: null, space: 'console' }),
  };
}

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } }));
  const [{ source, messagerie }] = useState(() => createSources(() => { router.replace(LOGIN_PATH); }));
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
            <ToastProvider>{children}</ToastProvider>
          </TooltipProvider>
        </MessagerieProvider>
      </ConsoleSourceProvider>
    </QueryClientProvider>
  );
}

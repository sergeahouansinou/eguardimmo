'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MessagerieProvider, consoleProfile, createDemoMessagerieSource } from '@eguardimmo/messagerie';
import { ToastProvider, TooltipProvider } from '@eguardimmo/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { createDemoSource } from '@/console/demo/source';
import { ConsoleSourceProvider } from '@/console/source';
import { messagerieRoutes } from '@/espace/messagerie';

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } }));
  const [source] = useState(() => createDemoSource());
  const [messagerie] = useState(() => createDemoMessagerieSource({ space: 'console' }));
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

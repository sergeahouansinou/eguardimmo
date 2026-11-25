"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/roost/Toast";
import { SessionProvider } from "@/features/session/SessionProvider";
import { I18nProvider } from "@/lib/i18n/context";
import { shouldRetry } from "@/marketplace/errors";

export function Providers({ apiUrl, authUrl, children }: { apiUrl: string; authUrl: string | undefined; children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: shouldRetry } } }));
  return (
    <QueryClientProvider client={client}>
      <SessionProvider apiUrl={apiUrl} authUrl={authUrl}>
        <I18nProvider>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

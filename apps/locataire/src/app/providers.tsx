"use client";

import type { ApiClient } from "@eguardimmo/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MessagerieProvider, createApiMessagerieSource, createDemoMessagerieSource, locataireProfile } from "@eguardimmo/messagerie";
import type { MessagerieSource } from "@eguardimmo/messagerie";
import { NotificationsApiProvider, ShellSourceProvider } from "@eguardimmo/shell";
import { TooltipProvider } from "@eguardimmo/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { LocataireSourceProvider } from "@/data/source";
import { createDemoSource } from "@/data/demoSource";
import { apiHelpCenter, apiLocataireProfile } from "@/espace/aide";
import { messagerieRoutes } from "@/espace/messagerie";
import { TenantAnnouncementsProvider } from "@/features/annonces/AnnouncementsProvider";
import { ConversationsProvider } from "@/features/conversations/ConversationsProvider";
import { SupportApiProvider } from "@/features/support/SupportApiProvider";
import { apiEnv, dataSource } from "@/lib/env";
import { shouldRetry } from "@/tenant/errors";
import { TenantGate, useTenantSession } from "@/tenant/session";
import { createApiShellSource } from "@/tenant/shellSource";

function createApiMessagerie(client: ApiClient): MessagerieSource {
  return {
    ...createApiMessagerieSource({ client, organizationId: null, space: "locataire" }),
    helpCenter: () => Promise.resolve(apiHelpCenter),
  };
}

function DemoData({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [source] = useState(createDemoSource);
  const [messagerie] = useState(() => createDemoMessagerieSource({ space: "locataire" }));
  return (
    <LocataireSourceProvider source={source}>
      <MessagerieProvider
        source={messagerie}
        profile={locataireProfile}
        routes={messagerieRoutes}
        Link={Link}
        navigate={(href) => { router.push(href); }}
      >
        {children}
      </MessagerieProvider>
    </LocataireSourceProvider>
  );
}

function ApiBridge({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { client } = useTenantSession();
  const shell = useMemo(() => createApiShellSource(client), [client]);
  const messagerie = useMemo(() => createApiMessagerie(client), [client]);
  return (
    <ShellSourceProvider source={shell}>
      <NotificationsApiProvider client={client} organizationId={null}>
        <MessagerieProvider
          source={messagerie}
          profile={apiLocataireProfile}
          routes={messagerieRoutes}
          Link={Link}
          navigate={(href) => { router.push(href); }}
        >
          <SupportApiProvider>
            <ConversationsProvider>
              <TenantAnnouncementsProvider>{children}</TenantAnnouncementsProvider>
            </ConversationsProvider>
          </SupportApiProvider>
        </MessagerieProvider>
      </NotificationsApiProvider>
    </ShellSourceProvider>
  );
}

function ApiData({ children }: { children: ReactNode }) {
  const env = apiEnv();
  return (
    <TenantGate apiUrl={env.NEXT_PUBLIC_API_URL} authUrl={env.NEXT_PUBLIC_AUTH_URL}>
      <ApiBridge>{children}</ApiBridge>
    </TenantGate>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, ...(dataSource === "api" ? { retry: shouldRetry } : {}) } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider>{dataSource === "api" ? <ApiData>{children}</ApiData> : <DemoData>{children}</DemoData>}</TooltipProvider>
    </QueryClientProvider>
  );
}

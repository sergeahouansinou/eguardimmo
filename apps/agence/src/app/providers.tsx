"use client";

import { createApiClient } from "@eguardimmo/api";
import { MessagerieProvider, agenceProfile, createApiMessagerieSource, createDemoMessagerieSource } from "@eguardimmo/messagerie";
import type { MessagerieSource } from "@eguardimmo/messagerie";
import { OrganizationGate, ShellSourceProvider, useOrganizationSession } from "@eguardimmo/shell";
import type { OrganizationSession } from "@eguardimmo/shell";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider, TooltipProvider } from "@eguardimmo/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import { createDemoSource } from "@/espace/demo";
import { messagerieRoutes } from "@/espace/messagerie";
import { apiEnv, dataSource } from "@/lib/env";

function createMessagerieSource(session: OrganizationSession | null): MessagerieSource {
  if (dataSource === "demo") return createDemoMessagerieSource({ space: "agence" });
  const client = session?.client ?? createApiClient({ baseUrl: apiEnv().NEXT_PUBLIC_API_URL });
  return createApiMessagerieSource({ client, organizationId: session?.organization.organization ?? null, space: "agence" });
}

function AgenceMessagerie({ children }: { children: ReactNode }) {
  const router = useRouter();
  const session = useOrganizationSession();
  const [messagerie] = useState(() => createMessagerieSource(session));
  return (
    <MessagerieProvider
      source={messagerie}
      profile={agenceProfile}
      routes={messagerieRoutes}
      Link={Link}
      navigate={(href) => { router.push(href); }}
    >
      {children}
    </MessagerieProvider>
  );
}

function AgenceData({ children }: { children: ReactNode }) {
  if (dataSource === "demo") return children;
  const env = apiEnv();
  return (
    <OrganizationGate apiUrl={env.NEXT_PUBLIC_API_URL} authUrl={env.NEXT_PUBLIC_AUTH_URL} kind="agency">
      {children}
    </OrganizationGate>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } }));
  const [source] = useState(createDemoSource);
  return (
    <QueryClientProvider client={client}>
      <ShellSourceProvider source={source}>
        <TooltipProvider>
          <ToastProvider>
            <AgenceData>
              <AgenceMessagerie>{children}</AgenceMessagerie>
            </AgenceData>
          </ToastProvider>
        </TooltipProvider>
      </ShellSourceProvider>
    </QueryClientProvider>
  );
}

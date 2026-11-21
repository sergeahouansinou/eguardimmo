"use client";

import { createApiClient } from "@eguardimmo/api";
import { MessagerieProvider, StaffMessagerieProvider, agenceApiProfile, agenceProfile, createApiMessagerieSource, createDemoMessagerieSource, createStaffApiSource } from "@eguardimmo/messagerie";
import type { MessagerieSource } from "@eguardimmo/messagerie";
import { GestionApiData } from "@eguardimmo/gestion";
import { useOrganizationSession } from "@eguardimmo/shell";
import type { OrganizationSession } from "@eguardimmo/shell";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider, TooltipProvider } from "@eguardimmo/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { agenceHelpCenter } from "@/espace/aide";
import { apiMessagerieRoutes, messagerieRoutes, staffMessagerieRoutes } from "@/espace/messagerie";
import { createStaffProofHook } from "@/espace/staffProof";
import { CampaignsApiProvider } from "@/features/campagnes/CampaignsApiProvider";
import { SupportApiProvider } from "@/features/support/SupportApiProvider";
import { MandatesApiProvider } from "@/features/portefeuille/api/MandatesApiProvider";
import { DemoAgenceShell } from "@/lib/DemoAgenceShell";
import { apiEnv, dataSource } from "@/lib/env";

function createMessagerieSource(session: OrganizationSession | null): MessagerieSource {
  if (dataSource === "demo") return createDemoMessagerieSource({ space: "agence" });
  const client = session?.client ?? createApiClient({ baseUrl: apiEnv().NEXT_PUBLIC_API_URL });
  return {
    ...createApiMessagerieSource({ client, organizationId: session?.organization.organization ?? null, space: "agence" }),
    helpCenter: () => Promise.resolve(agenceHelpCenter),
  };
}

function StaffMessagerie({ session, children }: { session: OrganizationSession; children: ReactNode }) {
  const router = useRouter();
  const { client, organization } = session;
  const source = useMemo(() => createStaffApiSource({ client, organizationId: organization.organization, role: organization.role }), [client, organization.organization, organization.role]);
  const useProof = useMemo(() => createStaffProofHook(client), [client]);
  return (
    <StaffMessagerieProvider
      source={source}
      routes={staffMessagerieRoutes}
      Link={Link}
      navigate={(href) => { router.push(href); }}
      role={organization.role}
      organizationKind={organization.kind}
      useProof={useProof}
    >
      {children}
    </StaffMessagerieProvider>
  );
}

function AgenceMessagerie({ children }: { children: ReactNode }) {
  const router = useRouter();
  const session = useOrganizationSession();
  const [messagerie] = useState(() => createMessagerieSource(session));
  const api = dataSource === "api";
  const provider = (
    <MessagerieProvider
      source={messagerie}
      profile={api ? agenceApiProfile : agenceProfile}
      routes={api ? apiMessagerieRoutes : messagerieRoutes}
      Link={Link}
      navigate={(href) => { router.push(href); }}
    >
      {children}
    </MessagerieProvider>
  );
  if (!api || session === null) return provider;
  return (
    <SupportApiProvider session={session}>
      <StaffMessagerie session={session}>
        <CampaignsApiProvider session={session}>{provider}</CampaignsApiProvider>
      </StaffMessagerie>
    </SupportApiProvider>
  );
}

function AgenceData({ children }: { children: ReactNode }) {
  if (dataSource === "demo") return <DemoAgenceShell>{children}</DemoAgenceShell>;
  const env = apiEnv();
  return (
    <GestionApiData apiUrl={env.NEXT_PUBLIC_API_URL} authUrl={env.NEXT_PUBLIC_AUTH_URL} kind="agency">
      <MandatesApiProvider>{children}</MandatesApiProvider>
    </GestionApiData>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } }));
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ToastProvider>
          <AgenceData>
            <AgenceMessagerie>{children}</AgenceMessagerie>
          </AgenceData>
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

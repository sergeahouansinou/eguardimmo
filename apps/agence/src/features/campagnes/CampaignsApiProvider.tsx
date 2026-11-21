"use client";

import { CampaignsProvider, createCampaignsApiSource } from "@eguardimmo/messagerie";
import type { CampaignsRoutes } from "@eguardimmo/messagerie";
import type { OrganizationSession } from "@eguardimmo/shell";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { agenceRoutes as r, campagneEditHref, campagneHref } from "@/espace/routes";
import { createStaffProofHook } from "@/espace/staffProof";

export const campaignsRoutes: CampaignsRoutes = {
  list: r.campagnes,
  newCampaign: r.campagneNew,
  detail: campagneHref,
  edit: campagneEditHref,
  messages: r.messages,
};

export function CampaignsApiProvider({ session, children }: { session: OrganizationSession; children: ReactNode }) {
  const router = useRouter();
  const { client, organization } = session;
  const source = useMemo(() => createCampaignsApiSource({ client, organizationId: organization.organization }), [client, organization.organization]);
  const useProof = useMemo(() => createStaffProofHook(client), [client]);
  return (
    <CampaignsProvider
      source={source}
      routes={campaignsRoutes}
      Link={Link}
      navigate={(href) => { router.push(href); }}
      role={organization.role}
      organizationKind={organization.kind}
      useProof={useProof}
      senderName={organization.name}
    >
      {children}
    </CampaignsProvider>
  );
}

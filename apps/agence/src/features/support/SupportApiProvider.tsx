"use client";

import { SupportAccessProvider, SupportProvider, createSupportAccessApiSource, createSupportApiSource } from "@eguardimmo/messagerie";
import type { OrganizationSession } from "@eguardimmo/shell";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { supportAccessRoutes, supportRoutes } from "@/espace/support";
import { createStaffProofHook } from "@/espace/staffProof";

export function SupportApiProvider({ session, children }: { session: OrganizationSession; children: ReactNode }) {
  const router = useRouter();
  const { client, organization } = session;
  const organizationId = organization.organization;
  const requests = useMemo(() => createSupportApiSource({ client, space: "organization", organizationId }), [client, organizationId]);
  const access = useMemo(() => createSupportAccessApiSource({ client, organizationId }), [client, organizationId]);
  const useProof = useMemo(() => createStaffProofHook(client), [client]);
  return (
    <SupportProvider space="organization" source={requests} routes={supportRoutes} Link={Link} navigate={(href) => { router.push(href); }}>
      <SupportAccessProvider source={access} routes={supportAccessRoutes} Link={Link} role={organization.role} useProof={useProof}>
        {children}
      </SupportAccessProvider>
    </SupportProvider>
  );
}

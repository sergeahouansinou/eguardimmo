"use client";

import { SupportAccessProvider, SupportProvider, createSupportAccessApiSource, createSupportApiSource } from "@eguardimmo/messagerie";
import { useOrganizationSession } from "@eguardimmo/shell";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { createStaffProofHook } from "@/features/support/staffProof";
import { bailleurSupportAccessRoutes, bailleurSupportRoutes } from "@/features/support/routes";
import { dataSource } from "@/lib/env";

function Bound({ children }: { children: ReactNode }) {
  const router = useRouter();
  const session = useOrganizationSession();
  const client = session?.client;
  const organizationId = session?.organization.organization;
  const requests = useMemo(
    () => (client && organizationId ? createSupportApiSource({ client, space: "organization", organizationId }) : null),
    [client, organizationId],
  );
  const access = useMemo(() => (client && organizationId ? createSupportAccessApiSource({ client, organizationId }) : null), [client, organizationId]);
  const useProof = useMemo(() => (client ? createStaffProofHook(client) : null), [client]);
  if (session === null || requests === null || access === null || useProof === null) return children;
  return (
    <SupportProvider space="organization" source={requests} routes={bailleurSupportRoutes} Link={Link} navigate={(href) => { router.push(href); }}>
      <SupportAccessProvider source={access} routes={bailleurSupportAccessRoutes} Link={Link} role={session.organization.role} useProof={useProof}>
        {children}
      </SupportAccessProvider>
    </SupportProvider>
  );
}

export function OrganizationSupportProvider({ children }: { children: ReactNode }) {
  return dataSource === "api" ? <Bound>{children}</Bound> : children;
}

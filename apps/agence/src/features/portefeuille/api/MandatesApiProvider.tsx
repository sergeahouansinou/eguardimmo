"use client";

import { useOrganizationSession } from "@eguardimmo/shell";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { PortefeuilleSourceProvider } from "../source";
import { createApiPortefeuilleSource } from "./apiPortefeuille";
import { createApiMandatesSource } from "./mandatesSource";

const WRITER_ROLES: readonly string[] = ["owner", "admin", "manager"];
const DEFAULTS_EDITOR_ROLES: readonly string[] = ["owner", "admin"];

export function MandatesApiProvider({ children }: { children: ReactNode }) {
  const session = useOrganizationSession();
  const client = session?.client;
  const organizationId = session?.organization.organization ?? null;
  const agencyName = session?.organization.name ?? "";
  const role = session?.organization.role ?? "";
  const canWrite = WRITER_ROLES.includes(role);
  const canEditDefaults = DEFAULTS_EDITOR_ROLES.includes(role);

  const source = useMemo(() => {
    if (!client) return null;
    return createApiPortefeuilleSource({ mandates: createApiMandatesSource({ client, organizationId }), agencyName, canWrite, canEditDefaults });
  }, [client, organizationId, agencyName, canWrite, canEditDefaults]);

  if (!source) return children;
  return <PortefeuilleSourceProvider value={source}>{children}</PortefeuilleSourceProvider>;
}

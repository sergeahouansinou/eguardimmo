"use client";

import { createContext, use } from "react";
import type { ReactNode } from "react";
import type { OrganizationSession } from "@eguardimmo/shell";
import { useOrgSource } from "@/features/org/useOrgSource";
import { demoAnnonces } from "./demo";
import { createApiAnnoncesSource } from "./source";
import type { AnnoncesSource } from "./source";

const SourceContext = createContext<AnnoncesSource | null>(null);

export function AnnoncesSourceProvider({ source, children }: { source: AnnoncesSource; children: ReactNode }) {
  return <SourceContext value={source}>{children}</SourceContext>;
}

function build(session: OrganizationSession): AnnoncesSource {
  return createApiAnnoncesSource({ client: session.client, organizationId: session.organization.organization });
}

export function useAnnoncesSource(): AnnoncesSource {
  return useOrgSource(use(SourceContext), build, demoAnnonces);
}

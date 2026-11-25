"use client";

import { createContext, use } from "react";
import type { ReactNode } from "react";
import type { OrganizationSession } from "@eguardimmo/shell";
import { useOrgSource } from "@/features/org/useOrgSource";
import { demoChamps } from "./demo";
import { createApiChampsSource } from "./source";
import type { ChampsSource } from "./source";

const SourceContext = createContext<ChampsSource | null>(null);

export function ChampsSourceProvider({ source, children }: { source: ChampsSource; children: ReactNode }) {
  return <SourceContext value={source}>{children}</SourceContext>;
}

function build(session: OrganizationSession): ChampsSource {
  return createApiChampsSource({ client: session.client, organizationId: session.organization.organization });
}

export function useChampsSource(): ChampsSource {
  return useOrgSource(use(SourceContext), build, demoChamps);
}

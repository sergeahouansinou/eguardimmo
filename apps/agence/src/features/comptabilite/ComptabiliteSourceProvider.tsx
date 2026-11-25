"use client";

import { createContext, use } from "react";
import type { ReactNode } from "react";
import type { OrganizationSession } from "@eguardimmo/shell";
import { useOrgSource } from "@/features/org/useOrgSource";
import { demoComptabilite } from "./demo";
import { createApiComptabiliteSource } from "./source";
import type { ComptabiliteSource } from "./source";

const SourceContext = createContext<ComptabiliteSource | null>(null);

export function ComptabiliteSourceProvider({ source, children }: { source: ComptabiliteSource; children: ReactNode }) {
  return <SourceContext value={source}>{children}</SourceContext>;
}

function build(session: OrganizationSession): ComptabiliteSource {
  return createApiComptabiliteSource({ client: session.client, organizationId: session.organization.organization });
}

export function useComptabiliteSource(): ComptabiliteSource {
  return useOrgSource(use(SourceContext), build, demoComptabilite);
}

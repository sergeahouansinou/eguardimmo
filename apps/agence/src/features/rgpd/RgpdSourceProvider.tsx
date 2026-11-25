"use client";

import { createContext, use } from "react";
import type { ReactNode } from "react";
import type { OrganizationSession } from "@eguardimmo/shell";
import { useOrgSource } from "@/features/org/useOrgSource";
import { demoRgpd } from "./demo";
import { createApiRgpdSource } from "./source";
import type { RgpdSource } from "./source";

const SourceContext = createContext<RgpdSource | null>(null);

export function RgpdSourceProvider({ source, children }: { source: RgpdSource; children: ReactNode }) {
  return <SourceContext value={source}>{children}</SourceContext>;
}

function build(session: OrganizationSession): RgpdSource {
  return createApiRgpdSource({ client: session.client, organizationId: session.organization.organization });
}

export function useRgpdSource(): RgpdSource {
  return useOrgSource(use(SourceContext), build, demoRgpd);
}

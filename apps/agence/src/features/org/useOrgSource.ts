import { useOrganizationSession } from "@eguardimmo/shell";
import type { OrganizationSession } from "@eguardimmo/shell";
import { useMemo } from "react";
import { dataSource } from "@/lib/env";
import { NO_ORGANIZATION_MESSAGE } from "./errors";

export function useOrgSource<T>(injected: T | null, build: (session: OrganizationSession) => T, demo: () => T): T {
  const session = useOrganizationSession();
  return useMemo(() => {
    if (injected !== null) return injected;
    if (dataSource === "demo") return demo();
    if (session === null) throw new Error(NO_ORGANIZATION_MESSAGE);
    return build(session);
  }, [injected, session, build, demo]);
}

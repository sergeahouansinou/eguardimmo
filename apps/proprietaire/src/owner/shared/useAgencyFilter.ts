"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useOwnerSelection } from "../selection";
import type { AgencyRef } from "./model";

export interface AgencyFilter {
  agencies: readonly AgencyRef[];
  agency: string | null;
  unknown: boolean;
  setAgency: (agencyId: string | null) => void;
}

export function useAgencyFilter(): AgencyFilter {
  const { accesses } = useOwnerSelection();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const agencies = useMemo(() => {
    const seen = new Map<string, AgencyRef>();
    for (const access of accesses) if (!seen.has(access.agencyId)) seen.set(access.agencyId, { id: access.agencyId, name: access.agencyName });
    return [...seen.values()];
  }, [accesses]);
  const requested = params.get("agency");
  const known = requested !== null && agencies.some((agency) => agency.id === requested);
  return {
    agencies,
    agency: known ? requested : null,
    unknown: requested !== null && !known,
    setAgency: (agencyId) => {
      const next = new URLSearchParams(params.toString());
      if (agencyId === null) next.delete("agency");
      else next.set("agency", agencyId);
      const query = next.toString();
      router.replace(query === "" ? pathname : `${pathname}?${query}`, { scroll: false });
    },
  };
}

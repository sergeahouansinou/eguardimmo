"use client";

import { orgKey, useOrgInfinite, useOrgQuery } from "@/features/org/queries";
import { useComptabiliteSource } from "./ComptabiliteSourceProvider";
import type { EntryFilters, StatementInput } from "./schemas";

const MODULE = "comptabilite";

export function useAccounts() {
  const source = useComptabiliteSource();
  return useOrgQuery(orgKey(MODULE, "comptes"), () => source.accounts());
}

export function useEntries(filters: EntryFilters) {
  const source = useComptabiliteSource();
  return useOrgInfinite(orgKey(MODULE, "ecritures", filters), (cursor) => source.entries(filters, cursor));
}

export function useEntry(id: string) {
  const source = useComptabiliteSource();
  return useOrgQuery(orgKey(MODULE, "ecriture", id), () => source.entry(id));
}

export function useLeaseOptions() {
  const source = useComptabiliteSource();
  return useOrgQuery(orgKey(MODULE, "baux"), () => source.leases());
}

export function useStatement(input: StatementInput | null) {
  const source = useComptabiliteSource();
  return useOrgQuery(
    orgKey(MODULE, "releve", input),
    () => {
      if (input === null) return Promise.reject(new Error("Relevé sans critères."));
      return source.statement(input);
    },
    input !== null,
  );
}

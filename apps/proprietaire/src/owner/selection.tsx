"use client";

import { createContext, use, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { OwnerAccess } from "./model";
import { useAgencies } from "./queries";

interface Selection {
  accesses: readonly OwnerAccess[];
  selected: OwnerAccess | null;
  select: (accessId: string) => void;
}

const SelectionContext = createContext<Selection | null>(null);

export function OwnerSelectionProvider({ children }: { children: ReactNode }) {
  const agencies = useAgencies();
  const [chosen, setChosen] = useState<string | null>(null);
  const accesses = useMemo(() => agencies.data ?? [], [agencies.data]);
  const value = useMemo<Selection>(
    () => ({
      accesses,
      selected: accesses.find((access) => access.accessId === chosen) ?? accesses[0] ?? null,
      select: setChosen,
    }),
    [accesses, chosen],
  );
  return <SelectionContext value={value}>{children}</SelectionContext>;
}

export function useOwnerSelection(): Selection {
  const value = use(SelectionContext);
  if (!value) throw new Error("OwnerSelectionProvider manquant autour de l’espace propriétaire.");
  return value;
}

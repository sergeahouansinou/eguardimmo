"use client";

import { useConsoleStats, useTicketStats } from "@eguardimmo/messagerie";
import { SpaceShell } from "@eguardimmo/shell";
import type { ShellCounts } from "@eguardimmo/shell";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import type { ReactNode } from "react";
import {
  RAIL_STORAGE_KEY,
  SPACE_LABEL,
  accountMenu,
  bottomItems,
  helpMenu,
  navigation,
  notifications,
  searchPagesFor,
} from "@/espace/config";
import { dataSource } from "@/lib/env";
import { useNavigationInputs, useNoNavigationInputs } from "@/espace/useOperator";
import { ApiRouteGate } from "./ApiRouteGate";

export function EspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const readStats = dataSource === "api" ? useConsoleStats : useTicketStats;
  const openTickets = readStats().data?.open;
  const readInputs = dataSource === "api" ? useNavigationInputs : useNoNavigationInputs;
  const { roles, pendingApprovals } = readInputs();
  const navigationWithTickets = useMemo(
    () => (counts: ShellCounts | undefined) => {
      const merged = {
        ...counts,
        ...(openTickets === undefined ? {} : { support: openTickets }),
        ...(pendingApprovals === undefined ? {} : { approbations: pendingApprovals }),
      };
      return navigation(merged, { roles });
    },
    [openTickets, pendingApprovals, roles],
  );
  return (
    <SpaceShell
      spaceLabel={SPACE_LABEL}
      logoSrc="/logo.png"
      currentPath={pathname}
      linkComponent={Link}
      onNavigate={(href) => { router.push(href); }}
      railStorageKey={RAIL_STORAGE_KEY}
      navigation={navigationWithTickets}
      bottomItems={bottomItems}
      accountMenu={accountMenu}
      helpMenu={helpMenu}
      notifications={notifications}
      searchPages={searchPagesFor(dataSource === "api")}
    >
      <ApiRouteGate>{children}</ApiRouteGate>
    </SpaceShell>
  );
}

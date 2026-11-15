"use client";

import { useTicketStats } from "@eguardimmo/messagerie";
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
  searchPages,
} from "@/espace/config";

export function EspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const openTickets = useTicketStats().data?.open;
  const navigationWithTickets = useMemo(
    () => (counts: ShellCounts | undefined) => navigation(openTickets === undefined ? counts : { ...counts, support: openTickets }),
    [openTickets],
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
      searchPages={searchPages}
    >
      {children}
    </SpaceShell>
  );
}

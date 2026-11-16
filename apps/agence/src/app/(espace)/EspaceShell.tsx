"use client";

import { SupportWidget, useInboxStats } from "@eguardimmo/messagerie";
import { SpaceShell } from "@eguardimmo/shell";
import type { ShellCounts } from "@eguardimmo/shell";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import type { ReactNode } from "react";
import {
  RAIL_STORAGE_KEY,
  SEARCH_NOTE,
  SEARCH_NOTE_API,
  SEARCH_PLACEHOLDER,
  SEARCH_PLACEHOLDER_API,
  SPACE_LABEL,
  accountMenu,
  addMenu,
  bottomItems,
  buildNavigation,
  buildSearchPages,
  helpMenu,
  notifications,
} from "@/espace/config";
import { dataSource } from "@/lib/env";
import { ApiRouteGate } from "./ApiRouteGate";

export function EspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchPages = useMemo(() => buildSearchPages({ records: dataSource === "demo" }), []);
  const unread = useInboxStats().data?.unread;
  const navigation = useMemo(
    () => (counts: ShellCounts | undefined) =>
      buildNavigation(unread === undefined ? counts : { ...counts, messages: unread }),
    [unread],
  );
  return (
    <>
      <SpaceShell
        spaceLabel={SPACE_LABEL}
        logoSrc="/logo.png"
        currentPath={pathname}
        linkComponent={Link}
        onNavigate={(href) => { router.push(href); }}
        railStorageKey={RAIL_STORAGE_KEY}
        navigation={navigation}
        bottomItems={bottomItems}
        accountMenu={accountMenu}
        notifications={notifications}
        searchPages={searchPages}
        searchPlaceholder={dataSource === "demo" ? SEARCH_PLACEHOLDER : SEARCH_PLACEHOLDER_API}
        searchNote={dataSource === "demo" ? SEARCH_NOTE : SEARCH_NOTE_API}
        addMenu={addMenu}
        helpMenu={helpMenu}
      >
        <ApiRouteGate>{children}</ApiRouteGate>
      </SpaceShell>
      <SupportWidget />
    </>
  );
}

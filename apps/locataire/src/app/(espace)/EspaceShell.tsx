"use client";

import { SupportWidget, useInboxStats } from "@eguardimmo/messagerie";
import { SpaceShell } from "@eguardimmo/shell";
import type { ShellCounts } from "@eguardimmo/shell";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  RAIL_STORAGE_KEY,
  SPACE_LABEL,
  accountMenu,
  bottomItems,
  buildNavigation,
  notifications,
  searchPages,
} from "@/espace/config";
import { FlashRegion } from "@/components/flash";

export function EspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const unread = useInboxStats().data?.unread;
  const navigation = (counts: ShellCounts | undefined) =>
    buildNavigation(unread === undefined ? counts : { ...counts, messages: unread });
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
      >
        <FlashRegion />
        {children}
      </SpaceShell>
      <SupportWidget />
    </>
  );
}

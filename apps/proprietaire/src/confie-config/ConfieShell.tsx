"use client";

import { SupportWidget, useInboxStats } from "@eguardimmo/messagerie";
import { SpaceShell } from "@eguardimmo/shell";
import type { ShellCounts } from "@eguardimmo/shell";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  RAIL_STORAGE_KEY,
  SEARCH_NOTE,
  SEARCH_PLACEHOLDER,
  SPACE_LABEL,
  accountMenu,
  bottomItems,
  buildNavigation,
  notifications,
  searchPages,
} from "./config";
import { dataSource } from "@/lib/env";
import { ApiConfieShell } from "@/owner/ApiConfieShell";
import { ConfieLink } from "./ConfieLink";
import { toRealHref, toShellPath } from "./paths";

function DemoConfieShell({ children }: { children: ReactNode }) {
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
        currentPath={toShellPath(pathname)}
        linkComponent={ConfieLink}
        onNavigate={(href) => { router.push(toRealHref(href)); }}
        railStorageKey={RAIL_STORAGE_KEY}
        navigation={navigation}
        bottomItems={bottomItems}
        accountMenu={accountMenu}
        notifications={notifications}
        searchPages={searchPages}
        searchPlaceholder={SEARCH_PLACEHOLDER}
        searchNote={SEARCH_NOTE}
      >
        {children}
      </SpaceShell>
      <SupportWidget />
    </>
  );
}

export function ConfieShell({ children }: { children: ReactNode }) {
  return dataSource === "api" ? <ApiConfieShell>{children}</ApiConfieShell> : <DemoConfieShell>{children}</DemoConfieShell>;
}

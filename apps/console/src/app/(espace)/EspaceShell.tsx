"use client";

import { SpaceShell } from "@eguardimmo/shell";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  return (
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
      helpMenu={helpMenu}
      notifications={notifications}
      searchPages={searchPages}
    >
      {children}
    </SpaceShell>
  );
}

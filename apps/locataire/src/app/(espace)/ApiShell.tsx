"use client";

import { SupportApiWidget, useSupportUnread, useUnreadAnnouncements, useUnreadMessages } from "@eguardimmo/messagerie";
import { SpaceShell } from "@eguardimmo/shell";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { FlashRegion } from "@/components/flash";
import { RAIL_STORAGE_KEY, SPACE_LABEL, notifications } from "@/espace/config";
import { apiAccountMenu, apiBottomItems, apiNavigation, apiSearchPages, withAnnouncementCount, withMessageCount, withSupportCount } from "@/espace/configApi";
import { ApiRouteGate } from "./ApiRouteGate";

export function ApiShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const unread = useUnreadMessages();
  const supportUnread = useSupportUnread();
  const announcements = useUnreadAnnouncements();
  const navigation = () => withAnnouncementCount(withSupportCount(withMessageCount(apiNavigation, unread), supportUnread), announcements?.count);
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
        bottomItems={apiBottomItems}
        accountMenu={apiAccountMenu}
        notifications={notifications}
        searchPages={apiSearchPages}
      >
        <FlashRegion />
        <ApiRouteGate>{children}</ApiRouteGate>
      </SpaceShell>
      <SupportApiWidget />
    </>
  );
}

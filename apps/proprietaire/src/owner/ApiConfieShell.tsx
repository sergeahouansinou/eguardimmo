"use client";

import { useSupportUnread, useUnreadAnnouncements, useUnreadMessages } from "@eguardimmo/messagerie";
import { SpaceShell } from "@eguardimmo/shell";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ConfieLink } from "@/confie-config/ConfieLink";
import { RAIL_STORAGE_KEY, SPACE_LABEL } from "@/confie-config/config";
import { toRealHref, toShellPath } from "@/confie-config/paths";
import { ApiRouteGate } from "./ApiRouteGate";
import { apiAccountMenu, apiBottomItems, apiNavigation, apiNotifications, apiSearchPages, withAnnouncementCount, withMessageCount, withSupportCount } from "./configApi";

export function ApiConfieShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const unread = useUnreadMessages();
  const supportUnread = useSupportUnread();
  const announcements = useUnreadAnnouncements();
  const navigation = () => withAnnouncementCount(withSupportCount(withMessageCount(apiNavigation, unread), supportUnread), announcements?.count);
  return (
    <SpaceShell
      spaceLabel={SPACE_LABEL}
      logoSrc="/logo.png"
      currentPath={toShellPath(pathname)}
      linkComponent={ConfieLink}
      onNavigate={(href) => { router.push(toRealHref(href)); }}
      railStorageKey={RAIL_STORAGE_KEY}
      navigation={navigation}
      bottomItems={apiBottomItems}
      accountMenu={apiAccountMenu}
      notifications={apiNotifications}
      searchPages={apiSearchPages}
    >
      <ApiRouteGate>{children}</ApiRouteGate>
    </SpaceShell>
  );
}

"use client";

import { bankingPermissions, tenantRequestsPermissions } from "@eguardimmo/gestion";
import { canManageAccess } from "@eguardimmo/messagerie";
import { SpaceShell, useOrganizationSession } from "@eguardimmo/shell";
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
import { useMessagesCount } from "@/features/messagerie/useMessagesCount";
import { SupportWidgetSlot } from "@/features/support/SupportWidgetSlot";
import { useSupportBadges } from "@/features/support/useSupportBadges";
import { dataSource } from "@/lib/env";
import { ApiRouteGate } from "./ApiRouteGate";

export function EspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const unread = useMessagesCount();
  const session = useOrganizationSession();
  const banking = dataSource === "api" && session !== null && bankingPermissions(session.organization.role).available;
  const requestPermissions = tenantRequestsPermissions(dataSource === "api" && session !== null ? session.organization.role : null);
  const tenantRequests = useMemo(
    () => (dataSource === "api" ? { manage: requestPermissions.manage, payments: requestPermissions.readPayments } : undefined),
    [requestPermissions.manage, requestPermissions.readPayments],
  );
  const searchPages = useMemo(() => buildSearchPages({ records: dataSource === "demo", banking, ...(tenantRequests ? { tenantRequests } : {}) }), [banking, tenantRequests]);
  const role = session?.organization.role;
  const badges = useSupportBadges();
  const manageAccess = session !== null && canManageAccess(session.organization.role);
  const navigation = useMemo(
    () => (counts: ShellCounts | undefined) =>
      buildNavigation(unread === undefined ? counts : { ...counts, messages: unread }, {
        rent: dataSource === "api",
        invoicing: dataSource === "api",
        ownerFunds: dataSource === "api",
        charges: dataSource === "api",
        banking,
        ...(tenantRequests ? { tenantRequests } : {}),
        planning: dataSource === "api",
        contacts: dataSource === "api",
        tax: dataSource === "api",
        analytics: dataSource === "api",
        activity: dataSource === "api" && (role === "owner" || role === "admin"),
        timezone: dataSource === "api" && (role === "owner" || role === "admin"),
        ...(dataSource === "api" ? { support: { manageAccess, requests: badges.requests, access: badges.access } } : {}),
      }),
    [unread, manageAccess, role, banking, tenantRequests, badges.requests, badges.access],
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
      <SupportWidgetSlot />
    </>
  );
}

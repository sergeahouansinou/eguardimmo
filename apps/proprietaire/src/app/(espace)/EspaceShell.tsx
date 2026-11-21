"use client";

import { GestionShell } from "@eguardimmo/gestion";
import { canManageAccess, useInboxStats } from "@eguardimmo/messagerie";
import { useOrganizationSession } from "@eguardimmo/shell";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { MessagerieSpaceProvider } from "@/features/messagerie/SpaceProvider";
import { OrganizationSupportProvider } from "@/features/support/OrganizationSupportProvider";
import { SupportWidgetSlot } from "@/features/support/SupportWidgetSlot";
import { useSupportBadges } from "@/features/support/useSupportBadges";
import { dataSource } from "@/lib/env";
import { ApiRouteGate } from "./ApiRouteGate";
import { BailleurData } from "./BailleurData";

function BailleurShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const unread = useInboxStats().data?.unread;
  const session = useOrganizationSession();
  const badges = useSupportBadges();
  const manageAccess = session !== null && canManageAccess(session.organization.role);
  const support = useMemo(
    () => (dataSource === "api" ? { manageAccess, requests: badges.requests, access: badges.access } : undefined),
    [manageAccess, badges.requests, badges.access],
  );
  return (
    <GestionShell
      spaceLabel="Espace bailleur"
      logoSrc="/logo.png"
      currentPath={pathname}
      linkComponent={Link}
      onNavigate={(href) => { router.push(href); }}
      unreadMessages={unread}
      rent={dataSource === "api"}
      timezone={dataSource === "api" && (session?.organization.role === "owner" || session?.organization.role === "admin")}
      {...(support ? { support } : {})}
    >
      <ApiRouteGate>{children}</ApiRouteGate>
    </GestionShell>
  );
}

export function EspaceShell({ children }: { children: ReactNode }) {
  return (
    <BailleurData>
      <MessagerieSpaceProvider space="bailleur">
        <OrganizationSupportProvider>
          <BailleurShell>{children}</BailleurShell>
          <SupportWidgetSlot />
        </OrganizationSupportProvider>
      </MessagerieSpaceProvider>
    </BailleurData>
  );
}

"use client";

import { GestionShell } from "@eguardimmo/gestion";
import { SupportWidget, useInboxStats } from "@eguardimmo/messagerie";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { MessagerieSpaceProvider } from "@/features/messagerie/SpaceProvider";
import { ApiRouteGate } from "./ApiRouteGate";
import { BailleurData } from "./BailleurData";

function BailleurShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const unread = useInboxStats().data?.unread;
  return (
    <GestionShell
      spaceLabel="Espace bailleur"
      logoSrc="/logo.png"
      currentPath={pathname}
      linkComponent={Link}
      onNavigate={(href) => { router.push(href); }}
      unreadMessages={unread}
    >
      <ApiRouteGate>{children}</ApiRouteGate>
    </GestionShell>
  );
}

export function EspaceShell({ children }: { children: ReactNode }) {
  return (
    <BailleurData>
      <MessagerieSpaceProvider space="bailleur">
        <BailleurShell>{children}</BailleurShell>
        <SupportWidget />
      </MessagerieSpaceProvider>
    </BailleurData>
  );
}

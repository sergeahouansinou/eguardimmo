"use client";

import { EquipeApiProvider, GestionShell } from "@eguardimmo/gestion";
import { OrganizationGate } from "@eguardimmo/shell";
import { SupportWidget, useInboxStats } from "@eguardimmo/messagerie";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { MessagerieSpaceProvider } from "@/features/messagerie/SpaceProvider";
import { apiEnv, dataSource } from "@/lib/env";

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
      {children}
    </GestionShell>
  );
}

function BailleurData({ children }: { children: ReactNode }) {
  if (dataSource === "demo") return children;
  const env = apiEnv();
  return (
    <OrganizationGate apiUrl={env.NEXT_PUBLIC_API_URL} authUrl={env.NEXT_PUBLIC_AUTH_URL} kind="individual">
      <EquipeApiProvider>{children}</EquipeApiProvider>
    </OrganizationGate>
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

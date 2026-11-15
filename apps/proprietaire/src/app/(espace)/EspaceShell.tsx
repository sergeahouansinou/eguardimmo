"use client";

import { GestionShell } from "@eguardimmo/gestion";
import { SupportWidget } from "@eguardimmo/messagerie";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { MessagerieSpaceProvider } from "@/features/messagerie/SpaceProvider";

export function EspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <MessagerieSpaceProvider space="bailleur">
      <GestionShell
        spaceLabel="Espace bailleur"
        logoSrc="/logo.png"
        currentPath={pathname}
        linkComponent={Link}
        onNavigate={(href) => { router.push(href); }}
      >
        {children}
      </GestionShell>
      <SupportWidget />
    </MessagerieSpaceProvider>
  );
}

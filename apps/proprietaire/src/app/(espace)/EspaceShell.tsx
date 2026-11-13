"use client";

import { GestionShell } from "@eguardimmo/gestion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

export function EspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <GestionShell
      spaceLabel="Espace bailleur"
      logoSrc="/logo.png"
      currentPath={pathname}
      linkComponent={Link}
      onNavigate={(href) => { router.push(href); }}
    >
      {children}
    </GestionShell>
  );
}

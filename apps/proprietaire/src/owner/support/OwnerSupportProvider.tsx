"use client";

import { SupportProvider, createSupportApiSource } from "@eguardimmo/messagerie";
import type { SupportRoutes } from "@eguardimmo/messagerie";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { confieRoutes } from "@/features/confie/routes";
import { useOwnerSession } from "../session";

export const ownerSupportRoutes: SupportRoutes = {
  board: confieRoutes.support,
  newRequest: confieRoutes.supportNouvelle,
  ticket: confieRoutes.supportTicket,
};

export function OwnerSupportProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { client } = useOwnerSession();
  const source = useMemo(() => createSupportApiSource({ client, space: "owner" }), [client]);
  return (
    <SupportProvider space="owner" source={source} routes={ownerSupportRoutes} Link={Link} navigate={(href) => { router.push(href); }}>
      {children}
    </SupportProvider>
  );
}

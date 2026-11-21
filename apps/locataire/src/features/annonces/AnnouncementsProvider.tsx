"use client";

import { AnnouncementsProvider, createAnnouncementsApiSource } from "@eguardimmo/messagerie";
import type { AnnouncementsRoutes } from "@eguardimmo/messagerie";
import Link from "next/link";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { useTenantSession } from "@/tenant/session";

export const announcementRoutes: AnnouncementsRoutes = {
  list: "/annonces",
  detail: (id) => `/annonces/${id}`,
  messages: "/messages",
};

export function TenantAnnouncementsProvider({ children }: { children: ReactNode }) {
  const { client } = useTenantSession();
  const source = useMemo(() => createAnnouncementsApiSource({ client, space: "tenant" }), [client]);
  return (
    <AnnouncementsProvider space="tenant" source={source} routes={announcementRoutes} Link={Link}>
      {children}
    </AnnouncementsProvider>
  );
}

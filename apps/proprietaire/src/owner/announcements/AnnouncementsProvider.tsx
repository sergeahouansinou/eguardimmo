"use client";

import { AnnouncementsProvider, createAnnouncementsApiSource } from "@eguardimmo/messagerie";
import type { AnnouncementsRoutes } from "@eguardimmo/messagerie";
import Link from "next/link";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { confieRoutes } from "@/features/confie/routes";
import { useOwnerSession } from "../session";

export const announcementRoutes: AnnouncementsRoutes = {
  list: confieRoutes.annonces,
  detail: confieRoutes.annonce,
  messages: confieRoutes.messages,
};

export function OwnerAnnouncementsProvider({ children }: { children: ReactNode }) {
  const { client } = useOwnerSession();
  const source = useMemo(() => createAnnouncementsApiSource({ client, space: "owner" }), [client]);
  return (
    <AnnouncementsProvider space="owner" source={source} routes={announcementRoutes} Link={Link}>
      {children}
    </AnnouncementsProvider>
  );
}

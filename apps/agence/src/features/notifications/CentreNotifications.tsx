"use client";

import { ApiNotificationsPage, NotificationsPage } from "@eguardimmo/shell";
import Link from "next/link";
import { agenceRoutes } from "@/espace/routes";
import { dataSource } from "@/lib/env";

export function CentreNotifications() {
  return dataSource === "api" ? (
    <ApiNotificationsPage Link={Link} settingsHref={agenceRoutes.compteNotifications} />
  ) : (
    <NotificationsPage Link={Link} settingsHref={agenceRoutes.compteNotifications} />
  );
}

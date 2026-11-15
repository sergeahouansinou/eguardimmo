"use client";

import { NotificationsPage } from "@eguardimmo/shell";
import Link from "next/link";
import { agenceRoutes } from "@/espace/routes";

export function CentreNotifications() {
  return <NotificationsPage Link={Link} settingsHref={agenceRoutes.compteNotifications} />;
}

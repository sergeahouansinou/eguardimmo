"use client";

import { NotificationsPage } from "@eguardimmo/shell";
import Link from "next/link";

export function CentreNotifications() {
  return <NotificationsPage Link={Link} settingsHref="/reglages/notifications" />;
}

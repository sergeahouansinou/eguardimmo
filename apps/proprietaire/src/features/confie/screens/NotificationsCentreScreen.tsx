"use client";

import { NotificationsPage } from "@eguardimmo/shell";
import { ConfieLink } from "@/confie-config/ConfieLink";
import { toShellHref } from "@/confie-config/paths";
import { confieRoutes } from "../routes";

export function NotificationsCentreScreen() {
  return <NotificationsPage Link={ConfieLink} settingsHref={toShellHref(confieRoutes.notifications)} />;
}

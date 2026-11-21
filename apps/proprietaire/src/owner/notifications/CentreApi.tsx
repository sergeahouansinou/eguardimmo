"use client";

import { ApiNotificationsPage } from "@eguardimmo/shell";
import { ConfieLink } from "@/confie-config/ConfieLink";
import { toShellHref } from "@/confie-config/paths";
import { confieRoutes } from "@/features/confie/routes";

export function CentreApi() {
  return <ApiNotificationsPage Link={ConfieLink} settingsHref={toShellHref(confieRoutes.notifications)} />;
}

"use client";

import { NotificationPreferencesPage } from "@eguardimmo/shell";
import { ConfieLink } from "@/confie-config/ConfieLink";
import { toShellHref } from "@/confie-config/paths";
import { confieRoutes } from "@/features/confie/routes";

export function PreferencesApi() {
  return <NotificationPreferencesPage audience="owner" Link={ConfieLink} allHref={toShellHref(confieRoutes.notificationsToutes)} />;
}

"use client";

import { NotificationPreferencesPage } from "@eguardimmo/shell";
import Link from "next/link";
import { agenceRoutes } from "@/espace/routes";

export function PreferencesApi() {
  return <NotificationPreferencesPage audience="staff" Link={Link} allHref={agenceRoutes.notifications} />;
}

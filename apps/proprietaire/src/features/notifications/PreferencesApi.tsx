"use client";

import { NotificationPreferencesPage } from "@eguardimmo/shell";
import Link from "next/link";

export function PreferencesApi() {
  return <NotificationPreferencesPage audience="staff" Link={Link} allHref="/notifications" />;
}

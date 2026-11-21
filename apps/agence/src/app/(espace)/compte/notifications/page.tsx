import type { Metadata } from "next";
import { NotificationsPage } from "@/features/compte/NotificationsPage";
import { PreferencesApi } from "@/features/notifications/PreferencesApi";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Notifications" };

export default function Page() {
  return dataSource === "api" ? <PreferencesApi /> : <NotificationsPage />;
}

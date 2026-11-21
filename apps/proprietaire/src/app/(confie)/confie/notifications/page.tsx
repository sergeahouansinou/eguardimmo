import type { Metadata } from "next";
import { NotificationsScreen } from "@/features/confie/screens/NotificationsScreen";
import { dataSource } from "@/lib/env";
import { PreferencesApi } from "@/owner/notifications/PreferencesApi";

export const metadata: Metadata = { title: "Notifications" };

export default function Page() {
  return dataSource === "api" ? <PreferencesApi /> : <NotificationsScreen />;
}

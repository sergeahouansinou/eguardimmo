import type { Metadata } from "next";
import { PreferencesApi } from "@/features/notifications/PreferencesApi";
import { ReglagesNotificationsScreen } from "@/features/outils/screensCompte";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Réglages, notifications" };

export default function Page() {
  return dataSource === "api" ? <PreferencesApi /> : <ReglagesNotificationsScreen />;
}

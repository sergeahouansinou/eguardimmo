import type { Metadata } from "next";
import { ReglagesNotificationsScreen } from "@/features/outils/screensCompte";

export const metadata: Metadata = { title: "Réglages, notifications" };

export default function Page() {
  return <ReglagesNotificationsScreen />;
}

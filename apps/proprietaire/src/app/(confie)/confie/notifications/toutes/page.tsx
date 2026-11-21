import type { Metadata } from "next";
import { NotificationsCentreScreen } from "@/features/confie/screens/NotificationsCentreScreen";
import { dataSource } from "@/lib/env";
import { CentreApi } from "@/owner/notifications/CentreApi";

export const metadata: Metadata = { title: "Toutes les notifications" };

export default function Page() {
  return dataSource === "api" ? <CentreApi /> : <NotificationsCentreScreen />;
}

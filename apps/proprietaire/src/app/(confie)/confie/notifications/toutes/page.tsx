import type { Metadata } from "next";
import { NotificationsCentreScreen } from "@/features/confie/screens/NotificationsCentreScreen";

export const metadata: Metadata = { title: "Toutes les notifications" };

export default function Page() {
  return <NotificationsCentreScreen />;
}

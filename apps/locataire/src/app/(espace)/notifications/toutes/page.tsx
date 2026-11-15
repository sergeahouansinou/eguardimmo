import type { Metadata } from "next";
import { CentreNotifications } from "@/features/notifications/CentreNotifications";

export const metadata: Metadata = { title: "Toutes les notifications" };

export default function Page() {
  return <CentreNotifications />;
}

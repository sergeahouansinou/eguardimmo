import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { NotificationsScreen } from "@/features/compte/NotificationsScreen";
import { PreferencesApi } from "@/features/notifications/PreferencesApi";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Notifications" };

export default function Page() {
  if (dataSource === "api") return <PreferencesApi />;
  return (
    <Suspense fallback={<Skeleton />}>
      <NotificationsScreen />
    </Suspense>
  );
}

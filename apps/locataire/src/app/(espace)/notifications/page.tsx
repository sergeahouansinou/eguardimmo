import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { NotificationsScreen } from "@/features/compte/NotificationsScreen";

export const metadata: Metadata = { title: "Notifications" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <NotificationsScreen />
    </Suspense>
  );
}

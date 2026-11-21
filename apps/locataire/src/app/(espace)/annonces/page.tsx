import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { AnnouncementsRoute } from "@/features/annonces/AnnouncementRoute";

export const metadata: Metadata = { title: "Annonces" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <AnnouncementsRoute />
    </Suspense>
  );
}

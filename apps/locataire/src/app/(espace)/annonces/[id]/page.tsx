import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { AnnouncementRoute } from "@/features/annonces/AnnouncementRoute";

export const metadata: Metadata = { title: "Annonce" };

export default function Page({ params }: PageProps<"/annonces/[id]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <AnnouncementRoute params={params} />
    </Suspense>
  );
}

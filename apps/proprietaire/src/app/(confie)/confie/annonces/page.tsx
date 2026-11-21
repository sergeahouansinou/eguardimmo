import { AnnouncementsListPage } from "@eguardimmo/messagerie";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/features/confie/ui/States";
import { ApiOnly } from "@/owner/ApiOnly";

export const metadata: Metadata = { title: "Annonces" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ApiOnly>
        <AnnouncementsListPage />
      </ApiOnly>
    </Suspense>
  );
}

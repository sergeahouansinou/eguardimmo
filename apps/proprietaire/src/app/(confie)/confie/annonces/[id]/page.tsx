import { AnnouncementDetailPage } from "@eguardimmo/messagerie";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/features/confie/ui/States";
import { ApiOnly } from "@/owner/ApiOnly";
import { WithParam } from "@/owner/WithParam";

export const metadata: Metadata = { title: "Annonce" };

export default function Page({ params }: PageProps<"/confie/annonces/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ApiOnly>
        <WithParam params={params} name="id">
          {(id) => <AnnouncementDetailPage announcementId={id} />}
        </WithParam>
      </ApiOnly>
    </Suspense>
  );
}

import { InboxPage } from "@eguardimmo/messagerie";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/features/confie/ui/States";

export const metadata: Metadata = { title: "Messages" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <InboxPage />
    </Suspense>
  );
}

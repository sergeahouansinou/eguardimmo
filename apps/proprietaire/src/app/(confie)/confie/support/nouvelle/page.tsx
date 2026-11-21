import { SupportNewRequestPage } from "@eguardimmo/messagerie";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/features/confie/ui/States";
import { ApiOnly } from "@/owner/ApiOnly";

export const metadata: Metadata = { title: "Nouvelle demande au support" };

export default function Page() {
  return (
    <ApiOnly>
      <Suspense fallback={<PageSkeleton />}>
        <SupportNewRequestPage />
      </Suspense>
    </ApiOnly>
  );
}

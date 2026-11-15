import { HelpPage } from "@eguardimmo/messagerie";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/features/confie/ui/States";

export const metadata: Metadata = { title: "Aide" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <HelpPage />
    </Suspense>
  );
}

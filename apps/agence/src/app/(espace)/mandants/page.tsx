import type { Metadata } from "next";
import { Suspense } from "react";
import { MandantsPage } from "@/features/portefeuille/mandants/MandantsPage";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

export const metadata: Metadata = { title: "Mandants" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MandantsPage />
    </Suspense>
  );
}

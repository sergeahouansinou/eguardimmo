import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { ImpayesPage } from "@/features/finances/impayes/ImpayesPage";

export const metadata: Metadata = { title: "Impayés" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ImpayesPage />
    </Suspense>
  );
}

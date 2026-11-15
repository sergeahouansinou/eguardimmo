import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { AvenantFormPage } from "@/features/portefeuille/mandats/AvenantFormPage";

export const metadata: Metadata = { title: "Nouvel avenant" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AvenantFormPage />
    </Suspense>
  );
}

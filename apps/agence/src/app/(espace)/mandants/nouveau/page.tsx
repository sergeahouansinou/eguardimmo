import type { Metadata } from "next";
import { Suspense } from "react";
import { MandantFormPage } from "@/features/portefeuille/mandants/MandantFormPage";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

export const metadata: Metadata = { title: "Nouveau mandant" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MandantFormPage />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { MandatFormPage } from "@/features/portefeuille/mandats/MandatFormPage";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

export const metadata: Metadata = { title: "Nouveau mandat" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MandatFormPage />
    </Suspense>
  );
}

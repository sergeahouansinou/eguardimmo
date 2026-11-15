import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { AvisEcheancePage } from "@/features/portefeuille/baux/AvisEcheancePage";

export const metadata: Metadata = { title: "Avis d'échéance" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AvisEcheancePage />
    </Suspense>
  );
}

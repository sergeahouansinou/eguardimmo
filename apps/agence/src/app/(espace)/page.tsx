import type { Metadata } from "next";
import { Suspense } from "react";
import { AccueilPage } from "@/features/portefeuille/accueil/AccueilPage";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

export const metadata: Metadata = { title: "Accueil" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AccueilPage />
    </Suspense>
  );
}

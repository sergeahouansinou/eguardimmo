import type { Metadata } from "next";
import { Suspense } from "react";
import { BauxPage } from "@/features/portefeuille/baux/BauxPage";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

export const metadata: Metadata = { title: "Baux" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BauxPage />
    </Suspense>
  );
}

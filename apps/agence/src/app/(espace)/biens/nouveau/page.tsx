import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { BienFormPage } from "@/features/portefeuille/biens/BienFormPage";

export const metadata: Metadata = { title: "Nouveau bien" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BienFormPage />
    </Suspense>
  );
}

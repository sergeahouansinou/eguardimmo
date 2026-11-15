import type { Metadata } from "next";
import { Suspense } from "react";
import { BailFormPage } from "@/features/portefeuille/baux/BailFormPage";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

export const metadata: Metadata = { title: "Nouveau bail" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BailFormPage />
    </Suspense>
  );
}

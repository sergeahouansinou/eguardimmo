import type { Metadata } from "next";
import { Suspense } from "react";
import { MandatsPage } from "@/features/portefeuille/mandats/MandatsPage";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

export const metadata: Metadata = { title: "Mandats" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MandatsPage />
    </Suspense>
  );
}

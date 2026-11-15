import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { LotPage } from "@/features/finances/reversements/LotPage";

export const metadata: Metadata = { title: "Lot de virements" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LotPage />
    </Suspense>
  );
}

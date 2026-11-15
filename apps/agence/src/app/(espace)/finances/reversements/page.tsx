import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { ReversementsPage } from "@/features/finances/reversements/ReversementsPage";

export const metadata: Metadata = { title: "Reversements" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReversementsPage />
    </Suspense>
  );
}

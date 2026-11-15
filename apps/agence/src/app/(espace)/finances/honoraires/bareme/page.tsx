import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { BaremePage } from "@/features/finances/honoraires/BaremePage";

export const metadata: Metadata = { title: "Barème des honoraires" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BaremePage />
    </Suspense>
  );
}

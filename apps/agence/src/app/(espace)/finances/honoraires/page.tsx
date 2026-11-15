import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { HonorairesPage } from "@/features/finances/honoraires/HonorairesPage";

export const metadata: Metadata = { title: "Honoraires" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <HonorairesPage />
    </Suspense>
  );
}

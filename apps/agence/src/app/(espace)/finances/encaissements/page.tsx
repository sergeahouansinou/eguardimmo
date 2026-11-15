import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { EncaissementsPage } from "@/features/finances/encaissements/EncaissementsPage";

export const metadata: Metadata = { title: "Encaissements" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EncaissementsPage />
    </Suspense>
  );
}

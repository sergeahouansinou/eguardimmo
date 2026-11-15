import type { Metadata } from "next";
import { Suspense } from "react";
import { LocatairesPage } from "@/features/portefeuille/locataires/LocatairesPage";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

export const metadata: Metadata = { title: "Locataires" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LocatairesPage />
    </Suspense>
  );
}

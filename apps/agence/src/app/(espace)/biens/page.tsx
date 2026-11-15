import type { Metadata } from "next";
import { Suspense } from "react";
import { BiensPage } from "@/features/portefeuille/biens/BiensPage";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

export const metadata: Metadata = { title: "Biens" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BiensPage />
    </Suspense>
  );
}

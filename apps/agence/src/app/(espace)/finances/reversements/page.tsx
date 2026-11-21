import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { ReversementsPage } from "@/features/finances/reversements/ReversementsPage";
import { ReversementsApiScreen } from "@/features/gestion/screens";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Reversements" };

export default function Page() {
  if (dataSource === "api") return <ReversementsApiScreen />;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReversementsPage />
    </Suspense>
  );
}

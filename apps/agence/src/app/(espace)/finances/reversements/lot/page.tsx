import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { LotPage } from "@/features/finances/reversements/LotPage";
import { ReversementLotApiScreen } from "@/features/gestion/screens";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Lot de virements" };

export default function Page() {
  if (dataSource === "api") return <ReversementLotApiScreen />;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LotPage />
    </Suspense>
  );
}

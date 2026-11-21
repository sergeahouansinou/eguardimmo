import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { BaremePage } from "@/features/finances/honoraires/BaremePage";
import { BaremeApiScreen } from "@/features/gestion/screens";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Barème des honoraires" };

export default function Page() {
  if (dataSource === "api") return <BaremeApiScreen />;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BaremePage />
    </Suspense>
  );
}

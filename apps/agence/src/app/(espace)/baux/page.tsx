import type { Metadata } from "next";
import { Suspense } from "react";
import { BauxPage } from "@/features/portefeuille/baux/BauxPage";
import { BauxScreen } from "@/features/gestion/screens";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Baux" };

export default function Page() {
  if (dataSource === "api") return <BauxScreen />;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BauxPage />
    </Suspense>
  );
}

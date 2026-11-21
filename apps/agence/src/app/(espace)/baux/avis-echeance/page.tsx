import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { AvisEcheanceScreen } from "@/features/gestion/screens";
import { AvisEcheancePage } from "@/features/portefeuille/baux/AvisEcheancePage";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Avis d'échéance" };

export default function Page() {
  if (dataSource === "api") return <AvisEcheanceScreen />;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AvisEcheancePage />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { ImpayesPage } from "@/features/finances/impayes/ImpayesPage";
import { ImpayesRecouvrementScreen } from "@/features/gestion/screens";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Impayés" };

export default function Page() {
  if (dataSource === "api") return <ImpayesRecouvrementScreen />;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ImpayesPage />
    </Suspense>
  );
}

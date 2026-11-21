import type { Metadata } from "next";
import { Suspense } from "react";
import { AccueilPage } from "@/features/portefeuille/accueil/AccueilPage";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { AccueilApiScreen, DemandesLocatairesScreen } from "@/features/gestion/screens";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Accueil" };

export default function Page() {
  if (dataSource === "api") return (<><AccueilApiScreen /><DemandesLocatairesScreen /></>);
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AccueilPage />
    </Suspense>
  );
}

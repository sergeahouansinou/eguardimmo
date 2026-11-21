import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { EncaissementsPage } from "@/features/finances/encaissements/EncaissementsPage";
import { LoyersPaiementsScreen } from "@/features/gestion/screens";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Encaissements" };

export default function Page() {
  if (dataSource === "api") return <LoyersPaiementsScreen />;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EncaissementsPage />
    </Suspense>
  );
}

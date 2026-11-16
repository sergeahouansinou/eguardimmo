import type { Metadata } from "next";
import { Suspense } from "react";
import { LocatairesScreen } from "@/features/gestion/screens";
import { LocatairesPage } from "@/features/portefeuille/locataires/LocatairesPage";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Locataires" };

export default function Page() {
  if (dataSource === "api") return <LocatairesScreen />;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LocatairesPage />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { GenerationPage } from "@/features/comptes-rendus/GenerationPage";
import { CompteRenduGenerationApiScreen } from "@/features/gestion/screens";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Générer les comptes rendus" };

export default function Page() {
  if (dataSource === "api") return <CompteRenduGenerationApiScreen />;
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <GenerationPage />
    </Suspense>
  );
}

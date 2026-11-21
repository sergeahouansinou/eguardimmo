import type { Metadata } from "next";
import { Suspense } from "react";
import { DevisApiScreen } from "@/features/gestion/screens";
import { DevisPage } from "@/features/interventions/DevisPage";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: dataSource === "api" ? "Devis" : "Devis à soumettre" };

export default function Page() {
  if (dataSource === "api") return <DevisApiScreen />;
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <DevisPage />
    </Suspense>
  );
}

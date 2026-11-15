import type { Metadata } from "next";
import { Suspense } from "react";
import { DevisPage } from "@/features/interventions/DevisPage";

export const metadata: Metadata = { title: "Devis à soumettre" };

export default function Page() {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <DevisPage />
    </Suspense>
  );
}

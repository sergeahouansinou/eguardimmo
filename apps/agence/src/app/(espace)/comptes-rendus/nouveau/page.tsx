import type { Metadata } from "next";
import { Suspense } from "react";
import { GenerationPage } from "@/features/comptes-rendus/GenerationPage";

export const metadata: Metadata = { title: "Générer les comptes rendus" };

export default function Page() {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <GenerationPage />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { ComptesRendusPage } from "@/features/comptes-rendus/ComptesRendusPage";

export const metadata: Metadata = { title: "Comptes rendus" };

export default function Page() {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <ComptesRendusPage />
    </Suspense>
  );
}

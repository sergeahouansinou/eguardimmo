import type { Metadata } from "next";
import { Suspense } from "react";
import { ComptesRendusPage } from "@/features/comptes-rendus/ComptesRendusPage";
import { ComptesRendusApiScreen } from "@/features/gestion/screens";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Comptes rendus" };

export default function Page() {
  if (dataSource === "api") return <ComptesRendusApiScreen />;
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <ComptesRendusPage />
    </Suspense>
  );
}

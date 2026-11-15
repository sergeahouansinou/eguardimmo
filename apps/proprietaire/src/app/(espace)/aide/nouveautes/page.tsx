import type { Metadata } from "next";
import { Suspense } from "react";
import { NouveautesPage } from "@/features/aide/NouveautesPage";

export const metadata: Metadata = { title: "Nouveautés" };

export default function Page() {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <NouveautesPage />
    </Suspense>
  );
}

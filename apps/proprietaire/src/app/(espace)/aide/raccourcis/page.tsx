import type { Metadata } from "next";
import { Suspense } from "react";
import { RaccourcisPage } from "@/features/aide/RaccourcisPage";

export const metadata: Metadata = { title: "Raccourcis clavier" };

export default function Page() {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <RaccourcisPage />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { SupportPage } from "@/features/aide/SupportPage";

export const metadata: Metadata = { title: "Discuter avec le support" };

export default function Page() {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <SupportPage />
    </Suspense>
  );
}

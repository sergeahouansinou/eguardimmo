import type { Metadata } from "next";
import { Suspense } from "react";
import { SignalerPage } from "@/features/aide/SignalerPage";

export const metadata: Metadata = { title: "Signaler un problème" };

export default function Page() {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <SignalerPage />
    </Suspense>
  );
}

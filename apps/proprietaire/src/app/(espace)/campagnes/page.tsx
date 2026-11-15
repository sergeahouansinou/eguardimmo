import { CampaignsPage } from "@eguardimmo/messagerie";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Campagnes" };

export default function Page() {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <CampaignsPage />
    </Suspense>
  );
}

import { LotsScreen } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";
import { Suspense } from "react";
import { BiensPage } from "@/features/portefeuille/biens/BiensPage";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Biens" };

export default function Page() {
  if (dataSource === "api") return <LotsScreen />;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BiensPage />
    </Suspense>
  );
}

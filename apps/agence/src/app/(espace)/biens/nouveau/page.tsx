import { LotForm } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { BienFormPage } from "@/features/portefeuille/biens/BienFormPage";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Nouveau bien" };

export default function Page() {
  if (dataSource === "api") return <LotForm />;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BienFormPage />
    </Suspense>
  );
}

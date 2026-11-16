import type { Metadata } from "next";
import { Suspense } from "react";
import { BailFormScreen } from "@/features/gestion/screens";
import { BailFormPage } from "@/features/portefeuille/baux/BailFormPage";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Nouveau bail" };

export default function Page() {
  if (dataSource === "api") return <BailFormScreen />;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BailFormPage />
    </Suspense>
  );
}

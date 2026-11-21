import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { ApiNouvelleScreen } from "@/features/interventions/ApiNouvelleScreen";
import { NouvelleScreen } from "@/features/interventions/NouvelleScreen";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Signaler un problème" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      {dataSource === "api" ? <ApiNouvelleScreen /> : <NouvelleScreen />}
    </Suspense>
  );
}

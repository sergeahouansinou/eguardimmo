import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { ApiInterventionsScreen } from "@/features/interventions/ApiInterventionsScreen";
import { InterventionsScreen } from "@/features/interventions/InterventionsScreen";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Interventions" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      {dataSource === "api" ? <ApiInterventionsScreen /> : <InterventionsScreen />}
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { ApiDepotScreen } from "@/features/assurance/ApiDepotScreen";
import { DepotScreen } from "@/features/assurance/DepotScreen";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Déposer une attestation" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      {dataSource === "api" ? <ApiDepotScreen /> : <DepotScreen />}
    </Suspense>
  );
}

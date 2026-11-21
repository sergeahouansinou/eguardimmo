import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { ApiEtatsScreen } from "@/features/etats/ApiEtatsScreen";
import { EtatsScreen } from "@/features/etats/EtatsScreen";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "États des lieux" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      {dataSource === "api" ? <ApiEtatsScreen /> : <EtatsScreen />}
    </Suspense>
  );
}

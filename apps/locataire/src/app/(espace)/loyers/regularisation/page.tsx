import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { ChargeStatementsScreen } from "@/features/charges/ChargeStatementsScreen";
import { ChargesScreen } from "@/features/loyers/ChargesScreen";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Régularisation des charges" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      {dataSource === "api" ? <ChargeStatementsScreen /> : <ChargesScreen />}
    </Suspense>
  );
}

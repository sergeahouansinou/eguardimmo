import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { ApiPayerScreen } from "@/features/loyers/ApiPayerScreen";
import { PayerScreen } from "@/features/loyers/PayerScreen";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Payer mon loyer" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      {dataSource === "api" ? <ApiPayerScreen /> : <PayerScreen />}
    </Suspense>
  );
}

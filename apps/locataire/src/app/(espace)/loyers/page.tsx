import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { InstallmentsScreen } from "@/features/rent/InstallmentsScreen";
import { LoyersScreen } from "@/features/loyers/LoyersScreen";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: dataSource === "api" ? "Mes loyers" : "Loyers et quittances" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      {dataSource === "api" ? <InstallmentsScreen /> : <LoyersScreen />}
    </Suspense>
  );
}

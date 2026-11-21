import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { BailScreen } from "@/features/bail/BailScreen";
import { LeasesScreen } from "@/features/baux/LeasesScreen";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: dataSource === "api" ? "Mes baux" : "Mon bail" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      {dataSource === "api" ? <LeasesScreen /> : <BailScreen />}
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { LeasesScreen } from "@/features/baux/LeasesScreen";
import { HomeScreen } from "@/features/accueil/HomeScreen";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: dataSource === "api" ? "Mes baux" : "Accueil" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      {dataSource === "api" ? <LeasesScreen /> : <HomeScreen />}
    </Suspense>
  );
}

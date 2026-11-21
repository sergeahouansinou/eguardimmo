import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { ApiCongeScreen } from "@/features/bail/ApiCongeScreen";
import { CongeScreen } from "@/features/bail/CongeScreen";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Donner congé" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      {dataSource === "api" ? <ApiCongeScreen /> : <CongeScreen />}
    </Suspense>
  );
}

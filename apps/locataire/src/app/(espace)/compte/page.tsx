import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { ApiInformationsScreen } from "@/features/compte/ApiAccountScreens";
import { InformationsScreen } from "@/features/compte/InformationsScreen";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Mes informations" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      {dataSource === "api" ? <ApiInformationsScreen /> : <InformationsScreen />}
    </Suspense>
  );
}

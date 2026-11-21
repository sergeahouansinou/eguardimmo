import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { ApiModifierScreen } from "@/features/compte/ApiModifierScreen";
import { ModifierScreen } from "@/features/compte/ModifierScreen";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Modifier mes informations" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      {dataSource === "api" ? <ApiModifierScreen /> : <ModifierScreen />}
    </Suspense>
  );
}

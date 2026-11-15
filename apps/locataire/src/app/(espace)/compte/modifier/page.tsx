import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { ModifierScreen } from "@/features/compte/ModifierScreen";

export const metadata: Metadata = { title: "Modifier mes informations" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <ModifierScreen />
    </Suspense>
  );
}

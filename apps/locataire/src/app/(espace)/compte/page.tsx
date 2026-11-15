import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { InformationsScreen } from "@/features/compte/InformationsScreen";

export const metadata: Metadata = { title: "Mes informations" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <InformationsScreen />
    </Suspense>
  );
}

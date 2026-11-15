import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { ChargesScreen } from "@/features/loyers/ChargesScreen";

export const metadata: Metadata = { title: "Régularisation des charges" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <ChargesScreen />
    </Suspense>
  );
}

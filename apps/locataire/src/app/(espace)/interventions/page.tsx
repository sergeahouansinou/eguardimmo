import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { InterventionsScreen } from "@/features/interventions/InterventionsScreen";

export const metadata: Metadata = { title: "Interventions" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <InterventionsScreen />
    </Suspense>
  );
}

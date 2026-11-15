import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { NouvelleScreen } from "@/features/interventions/NouvelleScreen";

export const metadata: Metadata = { title: "Signaler un problème" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <NouvelleScreen />
    </Suspense>
  );
}

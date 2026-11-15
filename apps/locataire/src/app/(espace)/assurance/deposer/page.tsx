import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { DepotScreen } from "@/features/assurance/DepotScreen";

export const metadata: Metadata = { title: "Déposer une attestation" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <DepotScreen />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { EtatsScreen } from "@/features/etats/EtatsScreen";

export const metadata: Metadata = { title: "États des lieux" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <EtatsScreen />
    </Suspense>
  );
}

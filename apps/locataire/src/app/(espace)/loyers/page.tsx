import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { LoyersScreen } from "@/features/loyers/LoyersScreen";

export const metadata: Metadata = { title: "Loyers et quittances" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <LoyersScreen />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { SepaScreen } from "@/features/loyers/SepaScreen";

export const metadata: Metadata = { title: "Prélèvement SEPA" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <SepaScreen />
    </Suspense>
  );
}

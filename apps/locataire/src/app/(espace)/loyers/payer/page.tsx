import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { PayerScreen } from "@/features/loyers/PayerScreen";

export const metadata: Metadata = { title: "Payer mon loyer" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <PayerScreen />
    </Suspense>
  );
}

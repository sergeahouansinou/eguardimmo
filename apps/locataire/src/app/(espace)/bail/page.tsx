import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { BailScreen } from "@/features/bail/BailScreen";

export const metadata: Metadata = { title: "Mon bail" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <BailScreen />
    </Suspense>
  );
}

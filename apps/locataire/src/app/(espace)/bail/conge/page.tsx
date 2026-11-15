import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { CongeScreen } from "@/features/bail/CongeScreen";

export const metadata: Metadata = { title: "Donner congé" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <CongeScreen />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { AssuranceScreen } from "@/features/assurance/AssuranceScreen";

export const metadata: Metadata = { title: "Assurance habitation" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <AssuranceScreen />
    </Suspense>
  );
}

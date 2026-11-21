import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { ApiAssuranceScreen } from "@/features/assurance/ApiAssuranceScreen";
import { AssuranceScreen } from "@/features/assurance/AssuranceScreen";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Assurance habitation" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      {dataSource === "api" ? <ApiAssuranceScreen /> : <AssuranceScreen />}
    </Suspense>
  );
}

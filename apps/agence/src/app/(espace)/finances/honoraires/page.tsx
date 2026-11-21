import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { HonorairesPage } from "@/features/finances/honoraires/HonorairesPage";
import { HonorairesApiScreen } from "@/features/gestion/screens";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Honoraires" };

export default function Page() {
  if (dataSource === "api") return <HonorairesApiScreen />;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <HonorairesPage />
    </Suspense>
  );
}

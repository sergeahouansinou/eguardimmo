import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { LeaseRoute } from "@/features/baux/LeaseRoute";

export const metadata: Metadata = { title: "Bail" };

export default function Page({ params }: PageProps<"/bail/[id]">) {
  return (
    <Suspense fallback={<Skeleton rows={4} />}>
      <LeaseRoute params={params} />
    </Suspense>
  );
}

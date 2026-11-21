import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { RentRoute } from "@/features/rent/RentRoute";

export const metadata: Metadata = { title: "Échéance" };

export default function Page({ params }: PageProps<"/loyers/echeances/[id]">) {
  return (
    <Suspense fallback={<Skeleton rows={4} />}>
      <RentRoute kind="echeance" params={params} />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { ChargeRoute } from "@/features/charges/ChargeRoute";

export const metadata: Metadata = { title: "Décompte de charges" };

export default function Page({ params }: PageProps<"/loyers/regularisation/[id]">) {
  return (
    <Suspense fallback={<Skeleton rows={4} />}>
      <ChargeRoute params={params} />
    </Suspense>
  );
}

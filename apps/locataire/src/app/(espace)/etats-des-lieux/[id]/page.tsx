import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { inspectionIds } from "@/data/staticParams";
import { EtatRoute } from "@/features/etats/EtatRoute";

export const metadata: Metadata = { title: "État des lieux" };

export function generateStaticParams() {
  return inspectionIds();
}

export default function Page({ params }: PageProps<"/etats-des-lieux/[id]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <EtatRoute params={params} />
    </Suspense>
  );
}

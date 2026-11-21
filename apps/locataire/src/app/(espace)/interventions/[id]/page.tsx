import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { interventionIds } from "@/data/staticParams";
import { DetailScreen } from "@/features/interventions/DetailScreen";
import { InterventionRoute } from "@/features/interventions/InterventionRoute";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Intervention" };

export function generateStaticParams() {
  return interventionIds();
}

export default function Page({ params }: PageProps<"/interventions/[id]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      {dataSource === "api" ? <InterventionRoute params={params} /> : <Screen params={params} />}
    </Suspense>
  );
}

async function Screen({ params }: Pick<PageProps<"/interventions/[id]">, "params">) {
  const { id } = await params;
  return <DetailScreen interventionId={id} />;
}

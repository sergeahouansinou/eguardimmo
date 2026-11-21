import type { Metadata } from "next";
import { Suspense } from "react";
import { InterventionDetailApiScreen } from "@/features/gestion/screens";
import { WithId } from "@/features/gestion/WithId";
import { InterventionDetailPage } from "@/features/interventions/InterventionDetailPage";
import { INTERVENTION_IDS } from "@/features/interventions/ids";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Intervention" };

export function generateStaticParams() {
  return INTERVENTION_IDS.map((id) => ({ id }));
}

const skeleton = <div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />;

export default function Page({ params }: PageProps<"/interventions/[id]">) {
  if (dataSource === "api") return <WithId params={params} fallback={skeleton}>{(id) => <InterventionDetailApiScreen id={id} />}</WithId>;
  return (
    <Suspense fallback={skeleton}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: Pick<PageProps<"/interventions/[id]">, "params">) {
  const { id } = await params;
  return <InterventionDetailPage id={id} />;
}

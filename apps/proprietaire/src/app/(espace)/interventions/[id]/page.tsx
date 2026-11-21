import { demoInterventions } from "@eguardimmo/gestion";
import type { Metadata } from "next";
import { Suspense } from "react";
import { InterventionDetailApiScreen } from "@/features/interventions/screens";
import { WithId } from "@/features/locataires/WithId";
import { InterventionDetailScreen } from "@/features/outils/screensSuivi";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Intervention" };

export function generateStaticParams() {
  return demoInterventions.map(({ id }) => ({ id }));
}

export default function Page({ params }: PageProps<"/interventions/[id]">) {
  if (dataSource === "api") return <WithId params={params}>{(id) => <InterventionDetailApiScreen id={id} />}</WithId>;
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: Pick<PageProps<"/interventions/[id]">, "params">) {
  const { id } = await params;
  return <InterventionDetailScreen id={id} />;
}

import { demoInterventions } from "@eguardimmo/gestion";
import type { Metadata } from "next";
import { Suspense } from "react";
import { InterventionDetailScreen } from "@/features/outils/screensSuivi";

export const metadata: Metadata = { title: "Intervention" };

export function generateStaticParams() {
  return demoInterventions.map(({ id }) => ({ id }));
}

export default function Page({ params }: PageProps<"/interventions/[id]">) {
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

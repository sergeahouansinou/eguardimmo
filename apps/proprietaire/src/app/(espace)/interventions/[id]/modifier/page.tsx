import { demoInterventions } from "@eguardimmo/gestion";
import type { Metadata } from "next";
import { Suspense } from "react";
import { InterventionFormScreen } from "@/features/outils/screensSuivi";

export const metadata: Metadata = { title: "Modifier l’intervention" };

export function generateStaticParams() {
  return demoInterventions.map(({ id }) => ({ id }));
}

export default function Page({ params }: PageProps<"/interventions/[id]/modifier">) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <Edit params={params} />
    </Suspense>
  );
}

async function Edit({ params }: Pick<PageProps<"/interventions/[id]/modifier">, "params">) {
  const { id } = await params;
  return <InterventionFormScreen id={id} />;
}

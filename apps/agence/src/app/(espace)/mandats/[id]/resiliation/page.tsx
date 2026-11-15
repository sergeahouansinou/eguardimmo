import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { MandatTerminationPage } from "@/features/portefeuille/mandats/MandatTerminationPage";
import { mandatIds } from "@/features/portefeuille/staticParams";

export const metadata: Metadata = { title: "Fin de mandat" };

export function generateStaticParams() {
  return mandatIds();
}

export default function Page({ params }: PageProps<"/mandats/[id]/resiliation">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Screen params={params} />
    </Suspense>
  );
}

async function Screen({ params }: Pick<PageProps<"/mandats/[id]/resiliation">, "params">) {
  const { id } = await params;
  return <MandatTerminationPage id={id} />;
}

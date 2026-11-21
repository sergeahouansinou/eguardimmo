import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { WithId } from "@/features/gestion/WithId";
import { MandatDetailPage } from "@/features/portefeuille/mandats/MandatDetailPage";
import { mandatIds } from "@/features/portefeuille/staticParams";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Mandat" };

export function generateStaticParams() {
  return mandatIds();
}

export default function Page({ params }: PageProps<"/mandats/[id]">) {
  if (dataSource === "api") return <WithId params={params} fallback={<PageSkeleton />}>{(id) => <MandatDetailPage id={id} />}</WithId>;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Screen params={params} />
    </Suspense>
  );
}

async function Screen({ params }: Pick<PageProps<"/mandats/[id]">, "params">) {
  const { id } = await params;
  return <MandatDetailPage id={id} />;
}

import { LotOverview } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { BienDetailPage } from "@/features/portefeuille/biens/BienDetailPage";
import { bienIds } from "@/features/portefeuille/staticParams";
import { WithId } from "@/features/gestion/WithId";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Bien" };

export function generateStaticParams() {
  return bienIds();
}

export default function Page({ params }: PageProps<"/biens/[id]">) {
  if (dataSource === "api") return <WithId params={params}>{(id) => <LotOverview id={id} />}</WithId>;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Screen params={params} />
    </Suspense>
  );
}

async function Screen({ params }: Pick<PageProps<"/biens/[id]">, "params">) {
  const { id } = await params;
  return <BienDetailPage id={id} />;
}

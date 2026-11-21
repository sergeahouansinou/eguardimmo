import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { ImpayeDetailPage } from "@/features/finances/impayes/ImpayeDetailPage";
import { lotIds } from "@/features/finances/ids";
import { LoyerDetailScreen } from "@/features/gestion/screens";
import { WithId } from "@/features/gestion/WithId";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Impayé" };

export function generateStaticParams() {
  return lotIds();
}

export default function Page({ params }: PageProps<"/finances/impayes/[id]">) {
  if (dataSource === "api") return <WithId params={params} fallback={<PageSkeleton />}>{(id) => <LoyerDetailScreen id={id} />}</WithId>;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Screen params={params} />
    </Suspense>
  );
}

async function Screen({ params }: Pick<PageProps<"/finances/impayes/[id]">, "params">) {
  const { id } = await params;
  return <ImpayeDetailPage lotId={id} />;
}

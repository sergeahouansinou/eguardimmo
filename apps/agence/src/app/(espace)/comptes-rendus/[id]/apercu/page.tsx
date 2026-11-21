import type { Metadata } from "next";
import { Suspense } from "react";
import { ApercuPage } from "@/features/comptes-rendus/ApercuPage";
import { REPORT_IDS } from "@/features/comptes-rendus/ids";
import { CompteRenduApiScreen } from "@/features/gestion/screens";
import { WithId } from "@/features/gestion/WithId";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Aperçu du compte rendu" };

export function generateStaticParams() {
  return REPORT_IDS.map((id) => ({ id }));
}

export default function Page({ params }: PageProps<"/comptes-rendus/[id]/apercu">) {
  if (dataSource === "api") return <WithId params={params} fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>{(id) => <CompteRenduApiScreen id={id} />}</WithId>;
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <Apercu params={params} />
    </Suspense>
  );
}

async function Apercu({ params }: Pick<PageProps<"/comptes-rendus/[id]/apercu">, "params">) {
  const { id } = await params;
  return <ApercuPage id={id} />;
}

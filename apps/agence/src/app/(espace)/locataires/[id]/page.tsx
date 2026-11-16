import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { LocataireDetailScreen } from "@/features/gestion/screens";
import { WithId } from "@/features/gestion/WithId";
import { LocataireDetailPage } from "@/features/portefeuille/locataires/LocataireDetailPage";
import { locataireIds } from "@/features/portefeuille/staticParams";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Locataire" };

export function generateStaticParams() {
  return locataireIds();
}

export default function Page({ params }: PageProps<"/locataires/[id]">) {
  if (dataSource === "api") return <WithId params={params}>{(id) => <LocataireDetailScreen id={id} />}</WithId>;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Screen params={params} />
    </Suspense>
  );
}

async function Screen({ params }: Pick<PageProps<"/locataires/[id]">, "params">) {
  const { id } = await params;
  return <LocataireDetailPage id={id} />;
}

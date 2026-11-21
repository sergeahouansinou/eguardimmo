import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { ReversementDetailPage } from "@/features/finances/reversements/ReversementDetailPage";
import { mandantIds } from "@/features/finances/ids";
import { ReversementMandantApiScreen } from "@/features/gestion/screens";
import { WithId } from "@/features/gestion/WithId";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Reversement" };

export function generateStaticParams() {
  return mandantIds();
}

export default function Page({ params }: PageProps<"/finances/reversements/[id]">) {
  if (dataSource === "api") return <WithId params={params} fallback={<PageSkeleton />}>{(id) => <ReversementMandantApiScreen id={id} />}</WithId>;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Screen params={params} />
    </Suspense>
  );
}

async function Screen({ params }: Pick<PageProps<"/finances/reversements/[id]">, "params">) {
  const { id } = await params;
  return <ReversementDetailPage mandantId={id} />;
}

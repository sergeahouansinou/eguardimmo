import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { CONFORMITE_IDS } from "@/features/conformite/ids";
import { PieceDetailPage } from "@/features/conformite/PieceDetailPage";
import { PieceConformiteApiScreen } from "@/features/gestion/screens";
import { WithId } from "@/features/gestion/WithId";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Pièce de conformité" };

export function generateStaticParams() {
  return CONFORMITE_IDS.map((id) => ({ id }));
}

export default function Page({ params }: PageProps<"/conformite/[id]">) {
  if (dataSource === "api") return <WithId params={params} fallback={<PageSkeleton />}>{(id) => <PieceConformiteApiScreen id={id} />}</WithId>;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Piece params={params} />
    </Suspense>
  );
}

async function Piece({ params }: Pick<PageProps<"/conformite/[id]">, "params">) {
  const { id } = await params;
  return <PieceDetailPage id={id} />;
}

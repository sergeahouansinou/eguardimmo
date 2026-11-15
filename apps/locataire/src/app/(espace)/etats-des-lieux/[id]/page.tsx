import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { inspectionIds } from "@/data/staticParams";
import { EtatDetailScreen } from "@/features/etats/EtatDetailScreen";

export const metadata: Metadata = { title: "État des lieux" };

export function generateStaticParams() {
  return inspectionIds();
}

export default function Page({ params }: PageProps<"/etats-des-lieux/[id]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Screen params={params} />
    </Suspense>
  );
}

async function Screen({ params }: Pick<PageProps<"/etats-des-lieux/[id]">, "params">) {
  const { id } = await params;
  return <EtatDetailScreen inspectionId={id} />;
}

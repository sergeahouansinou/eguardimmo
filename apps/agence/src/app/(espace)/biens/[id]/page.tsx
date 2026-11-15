import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { BienDetailPage } from "@/features/portefeuille/biens/BienDetailPage";
import { bienIds } from "@/features/portefeuille/staticParams";

export const metadata: Metadata = { title: "Bien" };

export function generateStaticParams() {
  return bienIds();
}

export default function Page({ params }: PageProps<"/biens/[id]">) {
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

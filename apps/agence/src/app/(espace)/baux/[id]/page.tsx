import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { BailDetailPage } from "@/features/portefeuille/baux/BailDetailPage";
import { bailIds } from "@/features/portefeuille/staticParams";

export const metadata: Metadata = { title: "Bail" };

export function generateStaticParams() {
  return bailIds();
}

export default function Page({ params }: PageProps<"/baux/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Screen params={params} />
    </Suspense>
  );
}

async function Screen({ params }: Pick<PageProps<"/baux/[id]">, "params">) {
  const { id } = await params;
  return <BailDetailPage id={id} />;
}

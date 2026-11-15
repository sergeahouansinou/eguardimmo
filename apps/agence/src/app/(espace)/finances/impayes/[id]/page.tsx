import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { ImpayeDetailPage } from "@/features/finances/impayes/ImpayeDetailPage";
import { lotIds } from "@/features/finances/ids";

export const metadata: Metadata = { title: "Impayé" };

export function generateStaticParams() {
  return lotIds();
}

export default function Page({ params }: PageProps<"/finances/impayes/[id]">) {
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

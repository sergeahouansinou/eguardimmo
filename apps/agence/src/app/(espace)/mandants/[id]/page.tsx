import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { MandantDetailPage } from "@/features/portefeuille/mandants/MandantDetailPage";
import { mandantIds } from "@/features/portefeuille/staticParams";

export const metadata: Metadata = { title: "Mandant" };

export function generateStaticParams() {
  return mandantIds();
}

export default function Page({ params }: PageProps<"/mandants/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Screen params={params} />
    </Suspense>
  );
}

async function Screen({ params }: Pick<PageProps<"/mandants/[id]">, "params">) {
  const { id } = await params;
  return <MandantDetailPage id={id} />;
}

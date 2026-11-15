import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { interventionIds } from "@/data/staticParams";
import { DetailScreen } from "@/features/interventions/DetailScreen";

export const metadata: Metadata = { title: "Intervention" };

export function generateStaticParams() {
  return interventionIds();
}

export default function Page({ params }: PageProps<"/interventions/[id]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Screen params={params} />
    </Suspense>
  );
}

async function Screen({ params }: Pick<PageProps<"/interventions/[id]">, "params">) {
  const { id } = await params;
  return <DetailScreen interventionId={id} />;
}

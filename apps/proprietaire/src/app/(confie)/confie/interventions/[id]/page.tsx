import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/features/confie/ui/States";
import { InterventionScreen } from "@/features/confie/screens/InterventionScreen";
import { createDemoData } from "@/features/confie/data/demo";

export const metadata: Metadata = { title: "Suivi de l'intervention" };

export function generateStaticParams() {
  return createDemoData().interventions.map((item) => item.id).map((id) => ({ id }));
}

export default function Page({ params }: PageProps<"/confie/interventions/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Screen params={params} />
    </Suspense>
  );
}

async function Screen({ params }: Pick<PageProps<"/confie/interventions/[id]">, "params">) {
  const { id } = await params;
  return <InterventionScreen id={id} />;
}

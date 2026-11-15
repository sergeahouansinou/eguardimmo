import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/features/confie/ui/States";
import { DevisScreen } from "@/features/confie/screens/DevisScreen";
import { createDemoData } from "@/features/confie/data/demo";

export const metadata: Metadata = { title: "Validation du devis" };

export function generateStaticParams() {
  return createDemoData().interventions.filter((item) => item.quote).map((item) => item.id).map((id) => ({ id }));
}

export default function Page({ params }: PageProps<"/confie/interventions/[id]/devis">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Screen params={params} />
    </Suspense>
  );
}

async function Screen({ params }: Pick<PageProps<"/confie/interventions/[id]/devis">, "params">) {
  const { id } = await params;
  return <DevisScreen id={id} />;
}

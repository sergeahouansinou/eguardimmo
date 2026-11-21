import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/features/confie/ui/States";
import { BienScreen } from "@/features/confie/screens/BienScreen";
import { createDemoData } from "@/features/confie/data/demo";
import { dataSource } from "@/lib/env";
import { PropertyScreen } from "@/owner/properties/PropertyScreen";
import { WithParam } from "@/owner/WithParam";

export const metadata: Metadata = { title: "Fiche du bien" };

export function generateStaticParams() {
  return createDemoData().lots.map((lot) => lot.id).map((id) => ({ id }));
}

export default function Page({ params }: PageProps<"/confie/biens/[id]">) {
  if (dataSource === "api") {
    return (
      <WithParam params={params} name="id">
        {(id) => <PropertyScreen id={id} />}
      </WithParam>
    );
  }
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Screen params={params} />
    </Suspense>
  );
}

async function Screen({ params }: Pick<PageProps<"/confie/biens/[id]">, "params">) {
  const { id } = await params;
  return <BienScreen id={id} />;
}

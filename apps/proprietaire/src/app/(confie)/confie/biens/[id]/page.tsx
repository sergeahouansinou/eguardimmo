import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/features/confie/ui/States";
import { BienScreen } from "@/features/confie/screens/BienScreen";
import { createDemoData } from "@/features/confie/data/demo";

export const metadata: Metadata = { title: "Fiche du bien" };

export function generateStaticParams() {
  return createDemoData().lots.map((lot) => lot.id).map((id) => ({ id }));
}

export default function Page({ params }: PageProps<"/confie/biens/[id]">) {
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

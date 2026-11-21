import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/features/confie/ui/States";
import { CompteRenduApercuScreen } from "@/features/confie/screens/CompteRenduApercuScreen";
import { createDemoData } from "@/features/confie/data/demo";
import { dataSource } from "@/lib/env";
import { ApercuScreen } from "@/owner/reports/ApercuScreen";
import { WithParam } from "@/owner/WithParam";

export const metadata: Metadata = { title: "Aperçu du compte rendu" };

export function generateStaticParams() {
  return createDemoData().reports.map((report) => report.id).map((id) => ({ id }));
}

export default function Page({ params }: PageProps<"/confie/comptes-rendus/[id]/apercu">) {
  if (dataSource === "api") {
    return (
      <WithParam params={params} name="id">
        {(id) => <ApercuScreen id={id} />}
      </WithParam>
    );
  }
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Screen params={params} />
    </Suspense>
  );
}

async function Screen({ params }: Pick<PageProps<"/confie/comptes-rendus/[id]/apercu">, "params">) {
  const { id } = await params;
  return <CompteRenduApercuScreen id={id} />;
}

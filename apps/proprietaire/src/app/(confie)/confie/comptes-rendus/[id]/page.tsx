import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/features/confie/ui/States";
import { CompteRenduScreen } from "@/features/confie/screens/CompteRenduScreen";
import { createDemoData } from "@/features/confie/data/demo";
import { dataSource } from "@/lib/env";
import { ReportScreen } from "@/owner/reports/ReportScreen";
import { WithParam } from "@/owner/WithParam";

export const metadata: Metadata = { title: "Compte rendu" };

export function generateStaticParams() {
  return createDemoData().reports.map((report) => report.id).map((id) => ({ id }));
}

export default function Page({ params }: PageProps<"/confie/comptes-rendus/[id]">) {
  if (dataSource === "api") {
    return (
      <WithParam params={params} name="id">
        {(id) => <ReportScreen id={id} />}
      </WithParam>
    );
  }
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Screen params={params} />
    </Suspense>
  );
}

async function Screen({ params }: Pick<PageProps<"/confie/comptes-rendus/[id]">, "params">) {
  const { id } = await params;
  return <CompteRenduScreen id={id} />;
}

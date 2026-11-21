import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/features/confie/ui/States";
import { ReversementScreen } from "@/features/confie/screens/ReversementScreen";
import { createDemoData } from "@/features/confie/data/demo";
import { dataSource } from "@/lib/env";
import { RentMonthScreen } from "@/owner/rent/RentScreens";
import { WithParam } from "@/owner/WithParam";

export const metadata: Metadata = { title: "Détail du reversement" };

export function generateStaticParams() {
  return createDemoData().settlements.map((item) => item.month).map((month) => ({ month }));
}

export default function Page({ params }: PageProps<"/confie/loyers/[month]">) {
  if (dataSource === "api") {
    return (
      <WithParam params={params} name="month">
        {(month) => <RentMonthScreen month={month} />}
      </WithParam>
    );
  }
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Screen params={params} />
    </Suspense>
  );
}

async function Screen({ params }: Pick<PageProps<"/confie/loyers/[month]">, "params">) {
  const { month } = await params;
  return <ReversementScreen month={month} />;
}

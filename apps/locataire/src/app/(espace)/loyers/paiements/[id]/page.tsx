import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { RentRoute } from "@/features/rent/RentRoute";
import { dataSource } from "@/lib/env";
import { paymentIds } from "@/data/staticParams";
import { PaymentStatusScreen } from "@/features/loyers/PaymentStatusScreen";

export const metadata: Metadata = { title: "Paiement" };

export function generateStaticParams() {
  return paymentIds();
}

export default function Page({ params }: PageProps<"/loyers/paiements/[id]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      {dataSource === "api" ? <RentRoute kind="paiement" params={params} /> : <Screen params={params} />}
    </Suspense>
  );
}

async function Screen({ params }: Pick<PageProps<"/loyers/paiements/[id]">, "params">) {
  const { id } = await params;
  return <PaymentStatusScreen paymentId={id} />;
}

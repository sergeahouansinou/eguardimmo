import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { paymentIds } from "@/data/staticParams";
import { ProviderSimulation } from "@/features/loyers/ProviderSimulation";

export const metadata: Metadata = { title: "Page de paiement simulée", robots: { index: false, follow: false } };

export function generateStaticParams() {
  return paymentIds();
}

export default function Page({ params }: PageProps<"/loyers/payer/simulation/[id]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Screen params={params} />
    </Suspense>
  );
}

async function Screen({ params }: Pick<PageProps<"/loyers/payer/simulation/[id]">, "params">) {
  const { id } = await params;
  return <ProviderSimulation paymentId={id} />;
}

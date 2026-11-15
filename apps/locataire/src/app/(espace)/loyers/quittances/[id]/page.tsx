import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { receiptIds } from "@/data/staticParams";
import { ReceiptScreen } from "@/features/loyers/ReceiptScreen";

export const metadata: Metadata = { title: "Quittance" };

export function generateStaticParams() {
  return receiptIds();
}

export default function Page({ params }: PageProps<"/loyers/quittances/[id]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Screen params={params} />
    </Suspense>
  );
}

async function Screen({ params }: Pick<PageProps<"/loyers/quittances/[id]">, "params">) {
  const { id } = await params;
  return <ReceiptScreen receiptId={id} />;
}

import { financesStaticIds } from "@eguardimmo/gestion/finances";
import type { Metadata } from "next";
import { Suspense } from "react";
import { FactureScreen } from "@/features/finances/screens";

export const metadata: Metadata = { title: "Facture" };

export function generateStaticParams() {
  return financesStaticIds().factures.map((id) => ({ id }));
}

export default function Page({ params }: PageProps<"/finances/factures/[id]">) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: Pick<PageProps<"/finances/factures/[id]">, "params">) {
  const { id } = await params;
  return <FactureScreen factureId={id} />;
}

import { financesStaticIds } from "@eguardimmo/gestion/finances";
import type { Metadata } from "next";
import { Suspense } from "react";
import { RelanceScreen } from "@/features/finances/screens";

export const metadata: Metadata = { title: "Relance" };

export function generateStaticParams() {
  return financesStaticIds().echeances.map((echeanceId) => ({ echeanceId }));
}

export default function Page({ params }: PageProps<"/finances/impayes/[echeanceId]/relance">) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: Pick<PageProps<"/finances/impayes/[echeanceId]/relance">, "params">) {
  const { echeanceId } = await params;
  return <RelanceScreen echeanceId={echeanceId} />;
}

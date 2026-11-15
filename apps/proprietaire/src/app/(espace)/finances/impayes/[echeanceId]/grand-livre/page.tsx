import { financesStaticIds } from "@eguardimmo/gestion/finances";
import type { Metadata } from "next";
import { Suspense } from "react";
import { GrandLivreScreen } from "@/features/finances/screens";

export const metadata: Metadata = { title: "Grand livre" };

export function generateStaticParams() {
  return financesStaticIds().echeances.map((echeanceId) => ({ echeanceId }));
}

export default function Page({ params }: PageProps<"/finances/impayes/[echeanceId]/grand-livre">) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: Pick<PageProps<"/finances/impayes/[echeanceId]/grand-livre">, "params">) {
  const { echeanceId } = await params;
  return <GrandLivreScreen echeanceId={echeanceId} />;
}

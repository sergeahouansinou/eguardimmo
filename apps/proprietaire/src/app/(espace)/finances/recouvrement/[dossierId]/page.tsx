import { financesStaticIds } from "@eguardimmo/gestion/finances";
import type { Metadata } from "next";
import { Suspense } from "react";
import { RecouvrementScreen } from "@/features/finances/screens";

export const metadata: Metadata = { title: "Recouvrement" };

export function generateStaticParams() {
  return financesStaticIds().dossiers.map((dossierId) => ({ dossierId }));
}

export default function Page({ params }: PageProps<"/finances/recouvrement/[dossierId]">) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: Pick<PageProps<"/finances/recouvrement/[dossierId]">, "params">) {
  const { dossierId } = await params;
  return <RecouvrementScreen dossierId={dossierId} />;
}

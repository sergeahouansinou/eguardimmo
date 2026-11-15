import { financesStaticIds } from "@eguardimmo/gestion/finances";
import type { Metadata } from "next";
import { Suspense } from "react";
import { RecuScreen } from "@/features/finances/screens";

export const metadata: Metadata = { title: "Reçu d'acompte" };

export function generateStaticParams() {
  return financesStaticIds().recus.map((id) => ({ id }));
}

export default function Page({ params }: PageProps<"/finances/recus/[id]">) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: Pick<PageProps<"/finances/recus/[id]">, "params">) {
  const { id } = await params;
  return <RecuScreen recuId={id} />;
}

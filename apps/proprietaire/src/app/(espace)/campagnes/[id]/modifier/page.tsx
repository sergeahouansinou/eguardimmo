import { NewCampaignPage } from "@eguardimmo/messagerie";
import type { Metadata } from "next";
import { Suspense } from "react";
import { campaignIds } from "@/features/messagerie/staticParams";

export const metadata: Metadata = { title: "Modifier la campagne" };

export function generateStaticParams() {
  return campaignIds("bailleur");
}

export default function Page({ params }: PageProps<"/campagnes/[id]/modifier">) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <Screen params={params} />
    </Suspense>
  );
}

async function Screen({ params }: Pick<PageProps<"/campagnes/[id]/modifier">, "params">) {
  const { id } = await params;
  return <NewCampaignPage campaignId={id} />;
}

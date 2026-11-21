import { NewCampaignPage } from "@eguardimmo/messagerie";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ApiCampaignEditor } from "@/features/campagnes/CampaignsScreens";
import { isUuid } from "@/features/messagerie/ids";
import { dataSource } from "@/lib/env";
import { campaignIds } from "@/espace/staticParams";

export const metadata: Metadata = { title: "Modifier la campagne" };

export function generateStaticParams() {
  return campaignIds();
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
  if (dataSource === "api") return isUuid(id) ? <ApiCampaignEditor id={id} /> : notFound();
  return <NewCampaignPage campaignId={id} />;
}

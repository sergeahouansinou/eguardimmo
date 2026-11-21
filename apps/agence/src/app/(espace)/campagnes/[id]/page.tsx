import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ApiCampaignDetail } from "@/features/campagnes/CampaignsScreens";
import { isUuid } from "@/features/messagerie/ids";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Campagne" };

export default function Page({ params }: PageProps<"/campagnes/[id]">) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <Screen params={params} />
    </Suspense>
  );
}

async function Screen({ params }: Pick<PageProps<"/campagnes/[id]">, "params">) {
  const { id } = await params;
  if (dataSource !== "api" || !isUuid(id)) notFound();
  return <ApiCampaignDetail id={id} />;
}

import { PlannedScreen, plannedStaticParams, resolvePlanned } from "@eguardimmo/shell";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { plannedScreens } from "@/espace/config";

export function generateStaticParams() {
  return plannedStaticParams(plannedScreens);
}

export async function generateMetadata({ params }: PageProps<"/[...ecran]">): Promise<Metadata> {
  const { ecran } = await params;
  return { title: resolvePlanned(plannedScreens, ecran) ?? "Page introuvable" };
}

export default function Page({ params }: PageProps<"/[...ecran]">) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <Screen params={params} />
    </Suspense>
  );
}

async function Screen({ params }: Pick<PageProps<"/[...ecran]">, "params">) {
  const { ecran } = await params;
  const title = resolvePlanned(plannedScreens, ecran);
  if (!title) notFound();
  return <PlannedScreen title={title} description="Cette page fait partie de la maquette de l’espace locataire. Elle sera livrée avec son module." />;
}

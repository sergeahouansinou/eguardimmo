import { plannedScreens } from "@eguardimmo/gestion";
import { Alert } from "@eguardimmo/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

const DELIVERED_ROUTES = ["/messages", "/messages/nouveau", "/campagnes", "/campagnes/nouvelle", "/aide"];

const screens = plannedScreens();
for (const href of DELIVERED_ROUTES) screens.delete(href);

export function generateStaticParams() {
  return Array.from(screens.keys(), (href) => ({ ecran: href.slice(1).split("/") }));
}

function titleOf(ecran: string[]): string | undefined {
  return screens.get(`/${ecran.join("/")}`);
}

export async function generateMetadata({ params }: PageProps<"/[...ecran]">): Promise<Metadata> {
  const { ecran } = await params;
  return { title: titleOf(ecran) ?? "Page introuvable" };
}

export default function Page({ params }: PageProps<"/[...ecran]">) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <PlannedScreen params={params} />
    </Suspense>
  );
}

async function PlannedScreen({ params }: Pick<PageProps<"/[...ecran]">, "params">) {
  const { ecran } = await params;
  const title = titleOf(ecran);
  if (!title) notFound();
  return (
    <>
      <h1 className="text-page-title">{title}</h1>
      <Alert tone="info" title="Écran prévu dans un prochain lot">
        Cette page fait partie de la maquette de l&apos;espace bailleur. Elle sera livrée avec son module.
      </Alert>
    </>
  );
}

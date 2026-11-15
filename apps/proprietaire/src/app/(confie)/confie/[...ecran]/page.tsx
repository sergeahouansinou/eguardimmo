import { PlannedScreen, plannedStaticParams, resolvePlanned } from "@eguardimmo/shell";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { plannedConfieScreens } from "@/features/confie/routes";
import { PageSkeleton } from "@/features/confie/ui/States";

export function generateStaticParams() {
  return plannedStaticParams(plannedConfieScreens);
}

export async function generateMetadata({ params }: PageProps<"/confie/[...ecran]">): Promise<Metadata> {
  const { ecran } = await params;
  return { title: resolvePlanned(plannedConfieScreens, ecran) ?? "Page introuvable" };
}

export default function Page({ params }: PageProps<"/confie/[...ecran]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Planned params={params} />
    </Suspense>
  );
}

async function Planned({ params }: Pick<PageProps<"/confie/[...ecran]">, "params">) {
  const { ecran } = await params;
  const title = resolvePlanned(plannedConfieScreens, ecran);
  if (!title) notFound();
  return <PlannedScreen title={title} description="Cette page fait partie de la maquette de l'espace propriétaire. Elle sera livrée avec son module." />;
}

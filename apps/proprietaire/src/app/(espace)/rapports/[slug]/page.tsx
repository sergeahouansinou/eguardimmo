import { RAPPORT_LOYERS_SLUG, RAPPORT_TYPES, findRapport } from "@eguardimmo/gestion";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RapportLoyersScreen, RapportScreen } from "@/features/outils/screensOutils";

export function generateStaticParams() {
  return RAPPORT_TYPES.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/rapports/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: findRapport(slug)?.label ?? "Rapport introuvable" };
}

export default function Page({ params }: PageProps<"/rapports/[slug]">) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <Rapport params={params} />
    </Suspense>
  );
}

async function Rapport({ params }: Pick<PageProps<"/rapports/[slug]">, "params">) {
  const { slug } = await params;
  const rapport = findRapport(slug);
  if (!rapport) notFound();
  if (rapport.slug === RAPPORT_LOYERS_SLUG) return <RapportLoyersScreen />;
  return <RapportScreen slug={rapport.slug} />;
}

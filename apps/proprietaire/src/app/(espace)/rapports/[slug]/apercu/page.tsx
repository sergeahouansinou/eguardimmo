import { RAPPORT_LOYERS_SLUG, RAPPORT_TYPES, findRapport } from "@eguardimmo/gestion";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ApercuReportScreen, ApercuRapportScreen } from "@/features/outils/screensOutils";

export function generateStaticParams() {
  return RAPPORT_TYPES.map(({ slug }) => ({ slug }));
}

export const metadata: Metadata = { title: "Aperçu du rapport" };

export default function Page({ params }: PageProps<"/rapports/[slug]/apercu">) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <Apercu params={params} />
    </Suspense>
  );
}

async function Apercu({ params }: Pick<PageProps<"/rapports/[slug]/apercu">, "params">) {
  const { slug } = await params;
  const rapport = findRapport(slug);
  if (!rapport) notFound();
  if (rapport.slug === RAPPORT_LOYERS_SLUG) {
    return (
      <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
        <ApercuRapportScreen />
      </Suspense>
    );
  }
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <ApercuReportScreen slug={rapport.slug} />
    </Suspense>
  );
}

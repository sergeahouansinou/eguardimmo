import type { Metadata } from "next";
import { Suspense } from "react";
import { CONFORMITE_IDS } from "@/features/conformite/ids";
import { PieceDetailPage } from "@/features/conformite/PieceDetailPage";

export const metadata: Metadata = { title: "Pièce de conformité" };

interface RouteProps {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return CONFORMITE_IDS.map((id) => ({ id }));
}

export default function Page({ params }: RouteProps) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <Piece params={params} />
    </Suspense>
  );
}

async function Piece({ params }: RouteProps) {
  const { id } = await params;
  return <PieceDetailPage id={id} />;
}

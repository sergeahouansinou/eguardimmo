import { SLUG_PATTERN } from "@eguardimmo/gestion/biens";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { ReactNode } from "react";

async function Resolved({ params, children }: { params: Promise<{ id: string }>; children: (id: string) => ReactNode }) {
  const { id } = await params;
  if (!SLUG_PATTERN.test(id)) notFound();
  return <>{children(id)}</>;
}

export function WithId({ params, fallback = null, children }: { params: Promise<{ id: string }>; fallback?: ReactNode; children: (id: string) => ReactNode }) {
  return (
    <Suspense fallback={fallback}>
      <Resolved params={params}>{children}</Resolved>
    </Suspense>
  );
}

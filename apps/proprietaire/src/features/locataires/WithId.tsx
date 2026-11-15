import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { ReactNode } from "react";

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

async function Resolved({ params, children }: { params: Promise<{ id: string }>; children: (id: string) => ReactNode }) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) notFound();
  return <>{children(id)}</>;
}

export function WithId({ params, children }: { params: Promise<{ id: string }>; children: (id: string) => ReactNode }) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <Resolved params={params}>{children}</Resolved>
    </Suspense>
  );
}

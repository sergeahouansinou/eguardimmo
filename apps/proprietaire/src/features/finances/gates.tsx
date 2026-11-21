import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { ReactNode } from "react";
import { dataSource } from "@/lib/env";

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function ApiOnly({ children }: { children: ReactNode }) {
  if (dataSource !== "api") notFound();
  return children;
}

export async function Resolved({ params, children }: { params: Promise<{ id: string }>; children: (id: string) => ReactNode }) {
  const { id } = await params;
  if (dataSource !== "api" || !ID_PATTERN.test(id)) notFound();
  return <>{children(id)}</>;
}

export function ApiWithId({ params, children }: { params: Promise<{ id: string }>; children: (id: string) => ReactNode }) {
  return (
    <Suspense fallback={<div role="status" aria-label="Chargement de la page" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <Resolved params={params}>{children}</Resolved>
    </Suspense>
  );
}

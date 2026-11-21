import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { ReactNode } from "react";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTH = /^(19|20)\d{2}-(0[1-9]|1[0-2])$/;

const PATTERNS = { id: UUID, month: MONTH } as const;

interface Props<K extends keyof typeof PATTERNS> {
  params: Promise<Record<K, string>>;
  name: K;
  children: (value: string) => ReactNode;
}

export async function Resolved<K extends keyof typeof PATTERNS>({ params, name, children }: Props<K>) {
  const value = (await params)[name];
  if (!PATTERNS[name].test(value)) notFound();
  return <>{children(value)}</>;
}

export function WithParam<K extends keyof typeof PATTERNS>(props: Props<K>) {
  return (
    <Suspense fallback={<div role="status" aria-label="Chargement de la page" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <Resolved {...props} />
    </Suspense>
  );
}

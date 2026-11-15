import { Suspense } from 'react';
import type { ReactNode } from 'react';

interface IdParamProps {
  params: Promise<{ id: string }>;
  children: (id: string) => ReactNode;
}

export function IdParam({ params, children }: IdParamProps) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <Resolved params={params}>{children}</Resolved>
    </Suspense>
  );
}

async function Resolved({ params, children }: IdParamProps) {
  const { id } = await params;
  return <>{children(id)}</>;
}

'use client';

import { Skeleton } from '@eguardimmo/ui';
import type { ReactNode } from 'react';

export function FicheSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-3">
      <Skeleton className="h-3 w-48" />
      <Skeleton className="h-6 w-56" />
      <Skeleton className="h-3 w-full max-w-lg" />
      <Skeleton shape="block" className="h-9 w-full max-w-xl" />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Skeleton shape="block" className="h-40" />
        <Skeleton shape="block" className="h-40" />
        <Skeleton shape="block" className="h-40" />
        <Skeleton shape="block" className="h-40" />
      </div>
    </div>
  );
}

export function TwoColumns({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{children}</div>;
}

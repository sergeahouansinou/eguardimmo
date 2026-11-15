'use client';

import { RotateCw } from 'lucide-react';
import { Alert, Button, Icon, Skeleton } from '@eguardimmo/ui';
import type { ReactNode } from 'react';
import type { BiensQuery } from '../queries';

export function ErrorPanel({ title, onRetry, children }: { title: string; onRetry?: () => void; children?: ReactNode }) {
  return (
    <Alert tone="danger" title={title}>
      <div className="flex flex-wrap items-center gap-2">
        <span>{children ?? 'Vérifiez votre connexion puis réessayez.'}</span>
        {onRetry ? (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            <Icon icon={RotateCw} />
            Réessayer
          </Button>
        ) : null}
      </div>
    </Alert>
  );
}

export function SkeletonRows({ rows = 5, label = 'Chargement' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} shape="block" className="h-9 w-full" />
      ))}
    </div>
  );
}

export function SkeletonCard({ lines = 4, label = 'Chargement' }: { lines?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className="w-full" />
      ))}
    </div>
  );
}

export interface QueryBoundaryProps<T> {
  query: BiensQuery<T>;
  errorTitle: string;
  skeleton?: ReactNode;
  children: (data: T) => ReactNode;
}

export function QueryBoundary<T>({ query, errorTitle, skeleton, children }: QueryBoundaryProps<T>) {
  if (query.isError) return <ErrorPanel title={errorTitle} onRetry={query.refetch} />;
  if (query.data === undefined) return skeleton ?? <SkeletonRows />;
  return <>{children(query.data)}</>;
}

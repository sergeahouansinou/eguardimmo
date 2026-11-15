'use client';

import type { ReactNode } from 'react';
import { Alert, Button } from '@eguardimmo/ui';
import type { ScreenQuery } from './queries';

export function LoadingBlock({ label = 'Chargement' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-2">
      {[0, 1, 2].map((row) => (
        <div key={row} aria-hidden="true" className="h-9 animate-pulse rounded-sm bg-muted" />
      ))}
    </div>
  );
}

export function ErrorBlock({ title, onRetry }: { title: string; onRetry?: () => void }) {
  return (
    <Alert tone="danger" title={title}>
      <span className="flex flex-wrap items-center gap-2">
        Vérifiez votre connexion puis réessayez.
        {onRetry ? (
          <Button variant="link" size="sm" onClick={onRetry}>
            Réessayer
          </Button>
        ) : null}
      </span>
    </Alert>
  );
}

export function EmptyBlock({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-1.5 rounded-lg border border-dashed border-line-control p-4">
      <p className="text-empty-title text-fg">{title}</p>
      {children ? <p className="text-body text-fg-muted">{children}</p> : null}
      {action}
    </div>
  );
}

export interface QueryStateProps<T> {
  query: ScreenQuery<T>;
  errorTitle: string;
  loadingLabel?: string;
  children: (data: T) => ReactNode;
}

export function QueryState<T>({ query, errorTitle, loadingLabel, children }: QueryStateProps<T>) {
  if (query.isError) return <ErrorBlock title={errorTitle} onRetry={query.refetch} />;
  if (query.data === undefined) return <LoadingBlock label={loadingLabel} />;
  return <>{children(query.data)}</>;
}

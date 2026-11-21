'use client';

import { Alert, Button, Skeleton } from '@eguardimmo/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { describeProblem } from '@/platform/errors';
import type { PlatformQuery } from '@/platform/context';

export interface NotFoundCopy {
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
}

export interface PlatformStateProps<T> {
  query: PlatformQuery<T>;
  label: string;
  notFound?: NotFoundCopy;
  children: (data: T) => ReactNode;
}

export function ProblemAlert({ error, label, onRetry }: { error: unknown; label: string; onRetry?: () => void }) {
  const problem = describeProblem(error);
  if (problem.kind === 'forbidden') {
    return (
      <Alert tone="warning" title="Accès réservé">
        {problem.message} Si vous pensez que c’est une erreur, demandez à un administrateur d’ajuster votre rôle d’opérateur.
      </Alert>
    );
  }
  const tone = problem.kind === 'rate_limited' ? 'warning' : 'danger';
  const title = problem.kind === 'rate_limited' ? 'Trop de requêtes' : `${label} n’a pas pu être chargé`;
  return (
    <Alert tone={tone} title={title}>
      <span className="flex flex-wrap items-center gap-2">
        {problem.message}
        {onRetry ? (
          <Button variant="link" onClick={onRetry}>
            Réessayer
          </Button>
        ) : null}
      </span>
    </Alert>
  );
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <div role="status" aria-label={`Chargement : ${label}`} className="flex flex-col gap-3">
      <Skeleton className="h-7 w-56" />
      <Skeleton shape="block" className="h-48" />
    </div>
  );
}

export function PlatformState<T>({ query, label, notFound, children }: PlatformStateProps<T>) {
  if (query.isError) {
    if (notFound && describeProblem(query.error).kind === 'not_found') {
      return (
        <div className="flex max-w-xl flex-col gap-3">
          <h1 className="text-page-title">{notFound.title}</h1>
          <Alert tone="warning" title="Introuvable">
            {notFound.description}
          </Alert>
          <div>
            <Button variant="secondary" asChild>
              <Link href={notFound.backHref}>{notFound.backLabel}</Link>
            </Button>
          </div>
        </div>
      );
    }
    return <ProblemAlert error={query.error} label={label} onRetry={query.refetch} />;
  }
  if (query.isPending || query.data === undefined) return <LoadingBlock label={label} />;
  return <>{children(query.data)}</>;
}

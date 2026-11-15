'use client';

import { Alert, Button, Skeleton } from '@eguardimmo/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { isNotFound } from '@/console/hooks/core';
import type { ConsoleQuery } from '@/console/hooks/core';

export interface QueryStateProps<T> {
  query: ConsoleQuery<T>;
  label: string;
  notFound?: { title: string; description: string; backHref: string; backLabel: string };
  children: (data: T) => ReactNode;
}

export function QueryState<T>({ query, label, notFound, children }: QueryStateProps<T>) {
  if (query.isError) {
    if (notFound && isNotFound(query.error)) {
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
    return (
      <Alert tone="danger" title={`${label} n’a pas pu être chargé`}>
        <span className="flex flex-wrap items-center gap-2">
          Réessayez dans un instant.
          <Button variant="link" onClick={query.refetch}>
            Réessayer
          </Button>
        </span>
      </Alert>
    );
  }
  if (query.isPending || query.data === undefined) {
    return (
      <div role="status" aria-label={`Chargement : ${label}`} className="flex flex-col gap-3">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
        <Skeleton shape="block" className="h-32" />
        <Skeleton shape="block" className="h-48" />
      </div>
    );
  }
  return <>{children(query.data)}</>;
}

'use client';

import { Alert, Button, Skeleton } from '@eguardimmo/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { problemMessage } from '@/console/api/problems';
import { isNotFound } from '@/console/hooks/core';
import type { ConsoleQuery } from '@/console/hooks/core';

export interface ActivityStateProps<T> {
  query: ConsoleQuery<T>;
  label: string;
  notFound?: { title: string; description: string; backHref: string; backLabel: string };
  children: (data: T) => ReactNode;
}

export function ActivityState<T>({ query, label, notFound, children }: ActivityStateProps<T>) {
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
          {problemMessage(query.error)}
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
        <Skeleton shape="block" className="h-48" />
      </div>
    );
  }
  return <>{children(query.data)}</>;
}

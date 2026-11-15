'use client';

import { Alert, Button, Card } from '@eguardimmo/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ScreenQuery } from '@/data/queries';

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Chargement" role="status" className="flex flex-col gap-3">
      <div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} aria-hidden="true" className="h-20 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}

export function LoadError({ title, onRetry }: { title: string; onRetry?: () => void }) {
  return (
    <Alert tone="danger" title={title}>
      Vérifiez votre connexion puis réessayez.
      {onRetry ? (
        <div className="mt-1">
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Réessayer
          </Button>
        </div>
      ) : null}
    </Alert>
  );
}

export function Async<T>({
  query,
  errorTitle,
  rows,
  children,
}: {
  query: ScreenQuery<T>;
  errorTitle: string;
  rows?: number;
  children: (data: T) => ReactNode;
}) {
  if (query.isError) return <LoadError title={errorTitle} onRetry={query.refetch} />;
  if (query.isPending || query.data === undefined) return <Skeleton rows={rows} />;
  return <>{children(query.data)}</>;
}

export function NotFoundState({ title, backHref, backLabel }: { title: string; backHref: string; backLabel: string }) {
  return (
    <Card className="max-w-xl gap-3 p-6">
      <h1 className="text-page-title">{title}</h1>
      <p className="text-body text-fg-muted">Cet élément n’existe pas ou n’est plus disponible dans votre espace.</p>
      <Button variant="secondary" asChild className="self-start">
        <Link href={backHref}>{backLabel}</Link>
      </Button>
    </Card>
  );
}

interface AsyncCommon {
  errorTitle: string;
  rows?: number;
}

export function Async2<A, B>({
  a,
  b,
  children,
  ...common
}: AsyncCommon & { a: ScreenQuery<A>; b: ScreenQuery<B>; children: (a: A, b: B) => ReactNode }) {
  return (
    <Async query={a} {...common}>
      {(dataA) => (
        <Async query={b} {...common}>
          {(dataB) => children(dataA, dataB)}
        </Async>
      )}
    </Async>
  );
}

export function Async3<A, B, C>({
  a,
  b,
  c,
  children,
  ...common
}: AsyncCommon & {
  a: ScreenQuery<A>;
  b: ScreenQuery<B>;
  c: ScreenQuery<C>;
  children: (a: A, b: B, c: C) => ReactNode;
}) {
  return (
    <Async2 a={a} b={b} {...common}>
      {(dataA, dataB) => (
        <Async query={c} {...common}>
          {(dataC) => children(dataA, dataB, dataC)}
        </Async>
      )}
    </Async2>
  );
}

export function Async4<A, B, C, D>({
  a,
  b,
  c,
  d,
  children,
  ...common
}: AsyncCommon & {
  a: ScreenQuery<A>;
  b: ScreenQuery<B>;
  c: ScreenQuery<C>;
  d: ScreenQuery<D>;
  children: (a: A, b: B, c: C, d: D) => ReactNode;
}) {
  return (
    <Async3 a={a} b={b} c={c} {...common}>
      {(dataA, dataB, dataC) => (
        <Async query={d} {...common}>
          {(dataD) => children(dataA, dataB, dataC, dataD)}
        </Async>
      )}
    </Async3>
  );
}

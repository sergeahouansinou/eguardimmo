"use client";

import { Alert, Button } from "@eguardimmo/ui";
import type { ClientQuery } from "@eguardimmo/shell";
import Link from "next/link";
import type { ReactNode } from "react";

export function PageSkeleton({ label = "Chargement de la page" }: { label?: string }) {
  return (
    <div aria-busy="true" aria-label={label} role="status" className="flex flex-col gap-3">
      <div className="h-7 w-56 animate-pulse rounded-sm bg-muted" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <div key={key} className="h-[76px] animate-pulse rounded-lg border border-line bg-surface" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-lg border border-line bg-surface" />
    </div>
  );
}

export function QueryBoundary<T>({ query, children }: { query: ClientQuery<T>; children: (data: T) => ReactNode }) {
  if (query.isError) {
    return (
      <Alert tone="danger" title="Cette page n'a pas pu être chargée">
        Vérifiez votre connexion puis rechargez la page.
      </Alert>
    );
  }
  if (query.data === undefined) return <PageSkeleton />;
  return <>{children(query.data)}</>;
}

export function NotFoundState({ title, backHref, backLabel }: { title: string; backHref: string; backLabel: string }) {
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <h1 className="text-page-title">{title}</h1>
      <p className="text-fg-muted">Cet élément n&apos;existe pas ou ne fait pas partie de votre mandat.</p>
      <Button variant="secondary" asChild className="self-start">
        <Link href={backHref}>{backLabel}</Link>
      </Button>
    </div>
  );
}

export function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="py-3 text-body text-fg-subtle">{children}</p>;
}

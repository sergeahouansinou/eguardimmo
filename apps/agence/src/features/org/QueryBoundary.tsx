"use client";

import { Alert, Button, Skeleton } from "@eguardimmo/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { OrgApiError, errorMessage } from "./errors";
import type { ClientQuery } from "./queries";

export function LoadingPanel({ label }: { label: string }) {
  return (
    <div role="status" aria-label={`Chargement : ${label}`} className="flex flex-col gap-3">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <Skeleton shape="block" className="h-32" />
      <Skeleton shape="block" className="h-48" />
    </div>
  );
}

export function QueryFailure({ error, label, onRetry }: { error: unknown; label: string; onRetry?: () => void }) {
  const kind = error instanceof OrgApiError ? error.kind : null;
  const retry = onRetry ? (
    <Button variant="secondary" size="sm" onClick={onRetry}>
      Réessayer
    </Button>
  ) : null;
  if (kind === "forbidden" || kind === "two_factor_required") {
    return (
      <Alert tone="info" title="Accès refusé">
        <span className="flex flex-wrap items-center gap-2">
          {errorMessage(error)}
          {kind === "two_factor_required" ? (
            <Link href="/compte/securite" className="text-action-on-subtle underline underline-offset-2">
              Ouvrir Connexion et sécurité
            </Link>
          ) : null}
        </span>
      </Alert>
    );
  }
  if (kind === "unauthenticated") {
    return (
      <Alert tone="warning" title="Session expirée">
        {errorMessage(error)}
      </Alert>
    );
  }
  if (kind === "unavailable" || kind === "unexpected_response" || kind === "rate_limited") {
    return (
      <Alert tone="warning" title={`${label} : non vérifiable pour le moment`}>
        <span className="flex flex-wrap items-center gap-2">
          {errorMessage(error)} Ce n’est pas un résultat vide : rien n’a pu être confirmé.
          {retry}
        </span>
      </Alert>
    );
  }
  return (
    <Alert tone="danger" title={`${label} n’a pas pu être chargé`}>
      <span className="flex flex-wrap items-center gap-2">
        {errorMessage(error)}
        {retry}
      </span>
    </Alert>
  );
}

export interface QueryBoundaryProps<T> {
  query: ClientQuery<T>;
  label: string;
  children: (data: T) => ReactNode;
}

export function QueryBoundary<T>({ query, label, children }: QueryBoundaryProps<T>) {
  if (query.isError) return <QueryFailure error={query.error} label={label} onRetry={query.refetch} />;
  if (query.isPending || query.data === undefined) return <LoadingPanel label={label} />;
  return <>{children(query.data)}</>;
}

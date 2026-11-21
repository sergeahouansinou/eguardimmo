"use client";

import { Alert, Button } from "@eguardimmo/ui";
import { describeFailure } from "../errors";
import { signInHref, useOwnerSession } from "../session";

const NO_RETRY = new Set(["rateLimited", "unauthenticated", "noAccess", "forbidden", "readOnly", "notFound", "unverified", "invalid", "twoFactorRequired", "reauthenticationRequired", "stale", "conflict"]);

export function FailureNotice({ title, error, onRetry }: { title: string; error: unknown; onRetry?: () => void }) {
  const { authUrl } = useOwnerSession();
  const failure = describeFailure(error);
  const href = failure.kind === "unauthenticated" ? signInHref(authUrl) : null;
  return (
    <Alert tone="danger" title={title}>
      <span className="flex flex-wrap items-center gap-2">
        {failure.message}
        {href ? (
          <Button asChild variant="link" size="sm">
            <a href={href}>Se connecter</a>
          </Button>
        ) : onRetry && !NO_RETRY.has(failure.kind) ? (
          <Button variant="link" size="sm" onClick={onRetry}>
            Réessayer
          </Button>
        ) : null}
      </span>
    </Alert>
  );
}

export function Loading({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-6 animate-pulse rounded-sm bg-muted" />
      ))}
    </div>
  );
}

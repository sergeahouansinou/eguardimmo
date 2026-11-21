'use client';

import { Alert, Button } from '@eguardimmo/ui';
import { describeFailure } from '@/tenant/errors';
import type { FailureWording } from '@/tenant/errors';
import { currentPageUrl, reauthHref } from '@/tenant/reauth';
import { signInHref, useTenantSession } from '@/tenant/session';

const NO_RETRY = new Set(['notFound', 'forbidden', 'noAccess', 'unverified', 'receiptVoid', 'reauthenticationRequired']);

export function FailureAlert({
  title,
  error,
  onRetry,
  wording,
}: {
  title: string;
  error: unknown;
  onRetry?: () => void;
  wording?: FailureWording;
}) {
  const { authUrl } = useTenantSession();
  const failure = describeFailure(error, wording);
  const href = failure.kind === 'unauthenticated' ? signInHref(authUrl) : null;
  const confirmHref = failure.kind === 'reauthenticationRequired' ? reauthHref(authUrl, currentPageUrl()) : null;
  return (
    <Alert tone="danger" title={title}>
      <span className="flex flex-wrap items-center gap-2">
        {failure.message}
        {href ? (
          <Button asChild variant="link" size="sm">
            <a href={href}>Se connecter</a>
          </Button>
        ) : confirmHref ? (
          <Button asChild variant="link" size="sm">
            <a href={confirmHref}>Confirmer mon identité</a>
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

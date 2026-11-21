'use client';

import { Alert, Button, Icon, Skeleton } from '@eguardimmo/ui';
import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { authUrl } from '../lib/spaceUrls';
import { describeAccountFailure } from './failure';

const NO_RETRY = new Set(['forbidden', 'notFound']);

function signInHref(): string | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(authUrl('/connexion'));
  url.searchParams.set('return_to', window.location.href);
  return url.toString();
}

export function HubLink({ path, label, hint }: { path: string; label: string; hint: string }) {
  return (
    <Button variant="secondary" size="sm" asChild>
      <a href={authUrl(path)} target="_blank" rel="noopener noreferrer" aria-label={`${label} ${hint}, s’ouvre dans un nouvel onglet`}>
        {label}
        <Icon icon={ExternalLink} />
      </a>
    </Button>
  );
}

export function FailureNotice({ title, error, onRetry }: { title: string; error: unknown; onRetry?: () => void }) {
  const failure = describeAccountFailure(error);
  const href = failure.kind === 'unauthenticated' ? signInHref() : null;
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
        <Skeleton key={index} className="h-6" />
      ))}
    </div>
  );
}

export function FactRow({ label, children, action }: { label: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 border-b border-line py-3 first:pt-0 last:border-b-0 last:pb-0">
      <dt className="basis-full text-caption text-fg-subtle">{label}</dt>
      <dd className="min-w-0 flex-1 basis-48 text-body text-fg [overflow-wrap:anywhere]">{children}</dd>
      {action ? <dd className="shrink-0">{action}</dd> : null}
    </div>
  );
}

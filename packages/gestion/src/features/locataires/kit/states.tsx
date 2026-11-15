'use client';

import { SearchX } from 'lucide-react';
import { Alert, EmptyState, Skeleton } from '@eguardimmo/ui';
import type { ReactNode } from 'react';
import { LinkButton } from './PageHeader';

export function ListLoading({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="flex flex-col gap-3 py-2">
      {[0, 1, 2, 3].map((key) => (
        <Skeleton key={key} className="h-8 w-full" shape="block" />
      ))}
    </div>
  );
}

export function LoadError({ title }: { title: string }) {
  return (
    <Alert tone="danger" title={title}>
      Vérifiez votre connexion puis rechargez la page.
    </Alert>
  );
}

export function NotFoundPanel({
  title,
  description,
  backHref,
  backLabel,
}: {
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <EmptyState icon={SearchX} title={title} description={description}>
      <LinkButton href={backHref}>{backLabel}</LinkButton>
    </EmptyState>
  );
}

export function NoRows({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-body text-fg-subtle">{children}</p>;
}

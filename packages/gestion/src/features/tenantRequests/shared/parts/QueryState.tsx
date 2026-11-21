'use client';

import { ListLoading, LoadError, NotFoundPanel, errorMessage } from '../../../locataires/kit';
import { TenantRequestsError } from '../errors';

export function QueryState({ query, label, title, notFound }: {
  query: { isPending: boolean; isError: boolean; error: Error | null };
  label: string;
  title: string;
  notFound?: { title: string; description: string; backHref: string; backLabel: string };
}) {
  if (query.isPending && !query.isError) return <ListLoading label={label} />;
  if (notFound && query.error instanceof TenantRequestsError && query.error.kind === 'not_found') return <NotFoundPanel {...notFound} />;
  return <LoadError title={query.error ? `${title} : ${errorMessage(query.error)}` : title} />;
}

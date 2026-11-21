'use client';

import { ChargesApiError } from '../api/chargesErrors';
import { ListLoading, LoadError, NotFoundPanel } from '../../../locataires/kit';
import { errorMessage } from '../../../locataires/kit';

export function QueryState({ query, label, title, notFound }: {
  query: { isPending: boolean; isError: boolean; error: Error | null };
  label: string;
  title: string;
  notFound: { title: string; description: string; backHref: string; backLabel: string };
}) {
  if (query.isPending && !query.isError) return <ListLoading label={label} />;
  if (query.error instanceof ChargesApiError && query.error.kind === 'not_found') return <NotFoundPanel {...notFound} />;
  return <LoadError title={query.error ? `${title} : ${errorMessage(query.error)}` : title} />;
}

'use client';

import { Alert, Button } from '@eguardimmo/ui';
import { ListLoading, NotFoundPanel, errorMessage } from '../locataires/kit';
import { OrgApiError } from './errors';

export interface NotFoundCopy {
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
}

export interface QueryStateProps {
  query: { isPending: boolean; isError: boolean; error: Error | null };
  label: string;
  title: string;
  notFound?: NotFoundCopy;
  onRetry?: () => void;
}

export function QueryState({ query, label, title, notFound, onRetry }: QueryStateProps) {
  if (query.isPending && !query.isError) return <ListLoading label={label} />;
  if (!query.isError) return null;
  const error = query.error;
  if (notFound && error instanceof OrgApiError && error.kind === 'not_found') return <NotFoundPanel {...notFound} />;
  if (error instanceof OrgApiError && error.kind === 'forbidden') {
    return (
      <Alert tone="info" title="Accès refusé">
        {error.message}
      </Alert>
    );
  }
  return (
    <Alert tone="danger" title={error ? `${title} : ${errorMessage(error)}` : title}>
      <span className="flex flex-wrap items-center gap-2">
        Vérifiez votre connexion puis réessayez.
        {onRetry ? <Button variant="secondary" size="sm" onClick={onRetry}>Réessayer</Button> : null}
      </span>
    </Alert>
  );
}

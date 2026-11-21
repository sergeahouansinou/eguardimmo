'use client';

import { Button } from '@eguardimmo/ui';
import { FailureAlert } from '@/components/FailureAlert';

export interface PagedQuery {
  hasNextPage: boolean;
  isFetchNextPageError: boolean;
  isFetchingNextPage: boolean;
  error: unknown;
  fetchNextPage: () => Promise<unknown>;
}

export function LoadMore({ query, label, errorTitle }: { query: PagedQuery; label: string; errorTitle: string }) {
  return (
    <>
      {query.isFetchNextPageError ? <FailureAlert title={errorTitle} error={query.error} onRetry={() => void query.fetchNextPage()} /> : null}
      {query.hasNextPage && !query.isFetchNextPageError ? (
        <div>
          <Button variant="secondary" loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
            {label}
          </Button>
        </div>
      ) : null}
    </>
  );
}

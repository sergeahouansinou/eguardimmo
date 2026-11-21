'use client';

import { ApiError } from '@eguardimmo/api';
import type { ReactNode } from 'react';
import { FailureAlert } from '@/components/FailureAlert';
import { NotFoundState, Skeleton } from '@/components/ScreenState';
import type { FailureWording } from '@/tenant/errors';

export interface DetailQuery<Data> {
  data: Data | undefined;
  isError: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
}

export function DetailState<Data>({
  query,
  notFound,
  failureTitle,
  wording,
  children,
}: {
  query: DetailQuery<Data>;
  notFound: { title: string; backHref: string; backLabel: string };
  failureTitle: string;
  wording?: FailureWording;
  children: (data: Data) => ReactNode;
}) {
  if (query.data !== undefined) return children(query.data);
  if (!query.isError) return <Skeleton rows={4} />;
  if (query.error instanceof ApiError && query.error.status === 404) return <NotFoundState {...notFound} />;
  return <FailureAlert title={failureTitle} error={query.error} onRetry={() => void query.refetch()} wording={wording} />;
}

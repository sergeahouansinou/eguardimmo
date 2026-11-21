import { ApiError } from '@eguardimmo/api';
import { isFinalFailure } from './api/errors';

export const POLL = { thread: 10_000, inbox: 30_000, unread: 60_000 } as const;
export const MAX_BACKOFF_MS = 300_000;

export function nextInterval(base: number, failures: number, error: unknown): number {
  if (failures === 0) return base;
  const backoff = Math.min(base * 2 ** failures, MAX_BACKOFF_MS);
  const retryAfter = error instanceof ApiError && error.retryAfterSeconds !== null ? error.retryAfterSeconds * 1000 : 0;
  return Math.min(Math.max(backoff, retryAfter), MAX_BACKOFF_MS);
}

interface Pollable {
  state: { error: unknown; fetchFailureCount: number };
}

export function pollEvery(base: number) {
  return (query: Pollable): number | false => {
    if (isFinalFailure(query.state.error)) return false;
    return nextInterval(base, query.state.fetchFailureCount, query.state.error);
  };
}

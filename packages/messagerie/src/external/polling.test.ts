import { ApiError } from '@eguardimmo/api';
import { describe, expect, it } from 'vitest';
import { MAX_BACKOFF_MS, POLL, nextInterval, pollEvery } from './polling';

const state = (error: unknown, fetchFailureCount: number) => ({ state: { error, fetchFailureCount } });

describe('cadence d’interrogation', () => {
  it('suit les cadences de l’ADR : 10 s le fil, 30 s la boîte, 60 s le compteur', () => {
    expect(POLL).toEqual({ thread: 10_000, inbox: 30_000, unread: 60_000 });
    expect(pollEvery(POLL.thread)(state(null, 0))).toBe(10_000);
  });

  it('double l’intervalle à chaque échec consécutif jusqu’à 5 minutes', () => {
    expect([1, 2, 3, 4, 5, 6].map((failures) => nextInterval(10_000, failures, new Error('x')))).toEqual([20_000, 40_000, 80_000, 160_000, 300_000, 300_000]);
    expect(MAX_BACKOFF_MS).toBe(300_000);
  });

  it('respecte Retry-After quand il dépasse le recul', () => {
    expect(nextInterval(10_000, 1, new ApiError(429, 'throttle', 'x', {}, 90))).toBe(90_000);
    expect(nextInterval(10_000, 1, new ApiError(429, 'throttle', 'x', {}, 900))).toBe(300_000);
  });

  it('cesse d’interroger quand la session ou l’accès est perdu', () => {
    const poll = pollEvery(POLL.thread);
    expect(poll(state(new ApiError(401, 'x', 'x'), 1))).toBe(false);
    expect(poll(state(new ApiError(404, 'x', 'x'), 1))).toBe(false);
    expect(poll(state(new ApiError(503, 'x', 'x'), 1))).toBe(20_000);
  });
});

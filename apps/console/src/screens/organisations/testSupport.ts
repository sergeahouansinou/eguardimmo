import { act, waitFor } from '@testing-library/react';
import { expect } from 'vitest';
import { json } from '../../../test/platform';
import type { RecordedRequest, Responder } from '../../../test/platform';
import { approvalList, meData } from '@/platform/fixtures';

export const consolePath = (request: RecordedRequest): string => request.url.pathname.replace('/api/v1/console', '');

interface Options {
  roles?: string[];
  pending?: Record<string, unknown>[];
}

/** Sert le profil opérateur et la file des demandes en attente ; le reste est confié à `handler`. */
export function withOperator({ roles = ['admin'], pending = [] }: Options, handler: Responder): Responder {
  return (request) => {
    const path = consolePath(request);
    if (request.method === 'GET' && path === '/me') return json(200, meData(roles));
    if (request.method === 'GET' && path === '/approvals') return json(200, approvalList(pending));
    return handler(request);
  };
}

/** Attend que le profil opérateur ait été servi et pris en compte : une absence de bouton ne prouve rien avant. */
export async function rolesLoaded(view: { requests: RecordedRequest[] }): Promise<void> {
  await waitFor(() => {
    expect(view.requests.some((request) => consolePath(request) === '/me')).toBe(true);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

import { act, screen, waitFor } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
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

export async function chooseOption(user: ReturnType<typeof userEvent.setup>, combobox: RegExp, option: string): Promise<void> {
  await user.click(await screen.findByRole('combobox', { name: combobox }));
  await user.click(await screen.findByRole('option', { name: option }));
}

/** Attend que le profil opérateur soit lu et appliqué : sans cela, une absence de bouton peut n'être qu'un chargement en cours. */
export async function operatorLoaded(requests: RecordedRequest[]): Promise<void> {
  await waitFor(() => { expect(requests.some((request) => request.method === 'GET' && consolePath(request) === '/me')).toBe(true); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
}

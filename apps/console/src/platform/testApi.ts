import { createApiClient } from '@eguardimmo/api';
import { vi } from 'vitest';
import { requestUrl } from '../../test/requestUrl';

export const jsonResponse = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

export function setupApi(...responses: Response[]) {
  const queue = [...responses];
  const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(queue.shift() ?? jsonResponse(500, { code: 'unexpected' })));
  const client = createApiClient({ baseUrl: 'https://console.test', fetchImpl, readCookie: () => 'x' });
  const url = (index = 0) => new URL(requestUrl(fetchImpl.mock.calls[index]?.[0] ?? ''));
  const method = (index = 0) => (fetchImpl.mock.calls[index]?.[1]?.method ?? 'GET').toUpperCase();
  const body = (index = 0): unknown => {
    const raw = fetchImpl.mock.calls[index]?.[1]?.body;
    return typeof raw === 'string' ? JSON.parse(raw) : null;
  };
  return { client, fetchImpl, url, method, body };
}

export const ERROR_CASES = [
  [401, { type: '/problems/unauthenticated', title: 'Non authentifié', status: 401, code: 'unauthenticated', detail: 'Connectez-vous.' }, 'unauthenticated', 'unauthenticated'],
  [403, { type: '/problems/operator_role_required', title: 'Rôle opérateur requis', status: 403, code: 'operator_role_required', detail: 'Votre rôle ne permet pas cette opération.' }, 'forbidden', 'operator_role_required'],
  [404, { type: '/problems/not_found', title: 'Introuvable', status: 404, code: 'not_found', detail: 'Ressource introuvable.' }, 'not_found', 'not_found'],
  [409, { type: '/problems/approval_not_pending', title: 'Conflit', status: 409, code: 'approval_not_pending', detail: 'Cette demande n’est plus en attente.' }, 'conflict', 'approval_not_pending'],
  [422, { type: '/problems/validation_failed', title: 'Invalide', status: 422, code: 'validation_failed', detail: 'Invalide.', errors: { reason: ['Le motif est trop court.'] } }, 'invalid', 'validation_failed'],
  [429, { type: '/problems/too_many_requests', title: 'Trop de requêtes', status: 429, code: 'too_many_requests', detail: 'Trop de requêtes.' }, 'rate_limited', 'too_many_requests'],
] as const;

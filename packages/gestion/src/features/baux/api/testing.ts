import { createApiClient } from '@eguardimmo/api';
import { vi } from 'vitest';

export interface RecordedCall {
  method: string;
  path: string;
  search: URLSearchParams;
  body: unknown;
}

export interface MockReply {
  status?: number;
  body?: unknown;
}

export type MockRoute = MockReply | ((call: RecordedCall) => MockReply);

const BASE_URL = 'https://api.test';

export function mockApi(routes: Record<string, MockRoute>) {
  const calls: RecordedCall[] = [];
  const fetchImpl = vi.fn<typeof fetch>((input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
    const call: RecordedCall = {
      method: init?.method ?? 'GET',
      path: url.pathname,
      search: url.searchParams,
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null,
    };
    calls.push(call);
    const route = routes[`${call.method} ${call.path}`];
    if (route === undefined) return Promise.resolve(new Response(JSON.stringify({ detail: `Route non prévue : ${call.method} ${call.path}` }), { status: 500 }));
    const reply = typeof route === 'function' ? route(call) : route;
    const status = reply.status ?? 200;
    return Promise.resolve(new Response(status === 204 ? null : JSON.stringify(reply.body ?? null), { status, headers: { 'Content-Type': 'application/json' } }));
  });
  const client = createApiClient({ baseUrl: BASE_URL, fetchImpl, readCookie: () => 'xsrf' });
  const callsTo = (method: string, path: string) => calls.filter((call) => call.method === method && call.path === path);
  return { client, calls, callsTo, fetchImpl };
}

export const orgPath = (organization: string, path: string): string => `/api/v1/org/${organization}${path}`;

import { createApiClient } from '@eguardimmo/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { vi } from 'vitest';

export const API_URL = 'http://api.test';

export interface Reply {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
  network?: boolean;
}

type Handler = Reply | ((call: { method: string; path: string }) => Reply);

export interface ApiStub {
  calls: { method: string; path: string }[];
  count: (method: string, path: string) => number;
}

export function stubApi(routes: Record<string, Handler>): ApiStub {
  const calls: ApiStub['calls'] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      const method = init?.method ?? 'GET';
      calls.push({ method, path: url.pathname });
      if (url.pathname === '/sanctum/csrf-cookie') return Promise.resolve(new Response(null, { status: 204 }));
      const handler = routes[`${method} ${url.pathname}`];
      if (handler === undefined) return Promise.reject(new Error(`Appel réseau inattendu : ${method} ${url.pathname}`));
      const reply = typeof handler === 'function' ? handler({ method, path: url.pathname }) : handler;
      if (reply.network) return Promise.reject(new TypeError('Failed to fetch'));
      const status = reply.status ?? 200;
      const payload = status === 204 ? null : JSON.stringify(reply.body ?? {});
      const contentType = status >= 400 ? 'application/problem+json' : 'application/json';
      return Promise.resolve(new Response(payload, { status, headers: { 'Content-Type': contentType, ...reply.headers } }));
    }),
  );
  return { calls, count: (method, path) => calls.filter((call) => call.method === method && call.path === path).length };
}

export function renderWithClient(build: (client: ReturnType<typeof createApiClient>) => ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const client = createApiClient({ baseUrl: API_URL });
  const user = userEvent.setup();
  const view = render(<QueryClientProvider client={queryClient}>{build(client)}</QueryClientProvider>);
  return { ...view, user, client };
}

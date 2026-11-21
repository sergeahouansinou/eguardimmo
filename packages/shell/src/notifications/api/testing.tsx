import { createApiClient } from '@eguardimmo/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps, ReactElement } from 'react';
import { vi } from 'vitest';
import { NotificationsApiProvider } from './context';

export const API_URL = 'http://api.test';

export interface Call {
  method: string;
  path: string;
  search: URLSearchParams;
  body: unknown;
}

export interface Reply {
  status?: number;
  body?: unknown;
  network?: boolean;
}

type Handler = Reply | ((call: Call) => Reply);

export interface ApiStub {
  calls: Call[];
  callsTo: (method: string, path: string) => Call[];
}

export function stubApi(routes: Record<string, Handler>): ApiStub {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      const method = init?.method ?? 'GET';
      if (url.pathname === '/sanctum/csrf-cookie') return Promise.resolve(new Response(null, { status: 204 }));
      const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
      const call = { method, path: url.pathname, search: url.searchParams, body };
      calls.push(call);
      const handler = routes[`${method} ${url.pathname}`];
      if (handler === undefined) return Promise.reject(new Error(`Appel réseau inattendu : ${method} ${url.pathname}`));
      const reply = typeof handler === 'function' ? handler(call) : handler;
      if (reply.network) return Promise.reject(new TypeError('Failed to fetch'));
      const status = reply.status ?? 200;
      const contentType = status >= 400 ? 'application/problem+json' : 'application/json';
      return Promise.resolve(new Response(JSON.stringify(reply.body ?? {}), { status, headers: { 'Content-Type': contentType } }));
    }),
  );
  return { calls, callsTo: (method, path) => calls.filter((call) => call.method === method && call.path === path) };
}

export function renderWithApi(element: ReactElement, organizationId: string | null) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const client = createApiClient({ baseUrl: API_URL });
  const user = userEvent.setup();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <NotificationsApiProvider client={client} organizationId={organizationId}>
        {element}
      </NotificationsApiProvider>
    </QueryClientProvider>,
  );
  return { ...view, user, queryClient };
}

export function TestLink({ href, children, onClick, ...props }: ComponentProps<'a'> & { href: string }) {
  return (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
      {...props}
    >
      {children}
    </a>
  );
}

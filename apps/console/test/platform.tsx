import { createApiClient } from '@eguardimmo/api';
import { ToastProvider, TooltipProvider } from '@eguardimmo/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { ProofDialogHost } from '@/features/proof/ProofDialog';
import { createPlatformApi } from '@/platform/api';
import { PlatformApiProvider } from '@/platform/context';
import { createProofBroker, createProofFetch } from '@/platform/proof';
import type { ProofBroker } from '@/platform/proof';
import { requestUrl } from './requestUrl';

export const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

export interface RecordedRequest {
  method: string;
  url: URL;
  body: Record<string, unknown> | null;
}

export type Responder = (request: RecordedRequest) => Response | undefined;

function recorded(input: Parameters<typeof fetch>[0], init: RequestInit | undefined): RecordedRequest {
  const raw = init?.body;
  let body: Record<string, unknown> | null = null;
  if (typeof raw === 'string' && raw !== '') body = JSON.parse(raw) as Record<string, unknown>;
  else if (raw instanceof FormData) body = Object.fromEntries([...raw.entries()].map(([key, value]) => [key, typeof value === 'string' ? value : value.name]));
  return { method: (init?.method ?? 'GET').toUpperCase(), url: new URL(requestUrl(input)), body };
}

/** Répond par `respond` (premier gagnant) ou par une erreur 500 explicite quand aucune route ne correspond. */
export function fakeServer(respond: Responder) {
  const requests: RecordedRequest[] = [];
  const fetchMock = vi.fn<typeof fetch>((input, init) => {
    const request = recorded(input, init);
    requests.push(request);
    const response = respond(request);
    return Promise.resolve(response ?? json(500, { code: 'unexpected_request', title: `Requête non prévue : ${request.method} ${request.url.pathname}` }));
  });
  return { fetchMock, requests, writes: () => requests.filter((request) => request.method !== 'GET') };
}

export interface PlatformRender extends RenderResult {
  broker: ProofBroker;
  requests: RecordedRequest[];
  writes: () => RecordedRequest[];
}

export function renderPlatform(ui: ReactElement, respond: Responder): PlatformRender {
  const server = fakeServer(respond);
  const broker = createProofBroker();
  const client = createApiClient({
    baseUrl: window.location.origin,
    fetchImpl: createProofFetch(server.fetchMock, broker),
    readCookie: () => 'x',
  });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } } });
  const result = render(
    <QueryClientProvider client={queries}>
      <PlatformApiProvider api={createPlatformApi(client)}>
        <TooltipProvider>
          <ToastProvider>
            {ui}
            <ProofDialogHost broker={broker} />
          </ToastProvider>
        </TooltipProvider>
      </PlatformApiProvider>
    </QueryClientProvider>,
  );
  return Object.assign(result, { broker, requests: server.requests, writes: server.writes });
}

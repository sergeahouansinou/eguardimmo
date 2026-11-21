import { createApiClient } from '@eguardimmo/api';
import { vi } from 'vitest';

export interface UploadedPart {
  name: string;
  type: string;
  size: number;
}

export interface RecordedCall {
  method: string;
  path: string;
  search: URLSearchParams;
  body: unknown;
  form: FormData | null;
  headers: Headers;
}

export interface MockReply {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
  file?: { content: string; type: string };
}

export type MockRoute = MockReply | ((call: RecordedCall) => MockReply);

const BASE_URL = 'https://api.test';

export function mockConformiteApi(routes: Record<string, MockRoute>) {
  const calls: RecordedCall[] = [];
  const fetchImpl = vi.fn<typeof fetch>((input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
    const call: RecordedCall = {
      method: init?.method ?? 'GET',
      path: url.pathname,
      search: url.searchParams,
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null,
      form: init?.body instanceof FormData ? init.body : null,
      headers: new Headers(init?.headers),
    };
    calls.push(call);
    const route = routes[`${call.method} ${call.path}`];
    if (route === undefined) return Promise.resolve(new Response(JSON.stringify({ detail: `Route non prévue : ${call.method} ${call.path}` }), { status: 500 }));
    const reply = typeof route === 'function' ? route(call) : route;
    const status = reply.status ?? 200;
    if (reply.file !== undefined) return Promise.resolve(new Response(reply.file.content, { status, headers: { 'Content-Type': reply.file.type, ...reply.headers } }));
    const contentType = status >= 400 ? 'application/problem+json' : 'application/json';
    return Promise.resolve(new Response(JSON.stringify(reply.body ?? null), { status, headers: { 'Content-Type': contentType, ...reply.headers } }));
  });
  const client = createApiClient({ baseUrl: BASE_URL, fetchImpl, readCookie: () => 'xsrf' });
  const callsTo = (method: string, path: string) => calls.filter((call) => call.method === method && call.path === path);
  return { client, calls, callsTo, fetchImpl };
}

export const documentsPath = (organization: string, path: string): string => `/api/v1/org/${organization}/documents${path}`;
export const catalogPath = (organization: string, path: string): string => `/api/v1/org/${organization}/catalog${path}`;

export function uploadedPart(form: FormData | null): UploadedPart | null {
  const entry = form?.get('file');
  return entry instanceof File ? { name: entry.name, type: entry.type, size: entry.size } : null;
}

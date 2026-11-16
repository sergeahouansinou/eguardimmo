import { vi } from 'vitest';
import { sealSession, SESSION_COOKIE } from '../session';

export const ORIGIN = 'http://localhost:3050';
export const API = 'http://api.interne:8000';
export const KEY = Buffer.alloc(32, 7);
export const RELAY_KEY = 'cle-de-relais-de-test-de-32-caracteres';

export function stubServerEnv(): void {
  vi.stubEnv('CONSOLE_API_URL', API);
  vi.stubEnv('CONSOLE_SESSION_SECRET', KEY.toString('base64'));
  vi.stubEnv('CONSOLE_TOKEN_TTL_MINUTES', '');
  vi.stubEnv('CONSOLE_RELAY_KEY', RELAY_KEY);
  vi.stubEnv('CONSOLE_TRUSTED_PROXY_HOPS', '');
}

export function stubFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const spy = vi.fn((url: string, init?: RequestInit) => Promise.resolve(handler(url, init ?? {})));
  vi.stubGlobal('fetch', spy);
  return spy;
}

export function sessionCookieHeader(token = 'jeton-operateur', expiresAt = Date.now() + 60_000, key: Buffer = KEY): string {
  return `${SESSION_COOKIE}=${sealSession({ token, expiresAt }, key)}`;
}

export function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

export function call(path: string, init: RequestInit & { origin?: string | null; cookie?: string } = {}): Request {
  const { origin = ORIGIN, cookie, headers, ...rest } = init;
  const merged = new Headers(headers);
  if (origin !== null) merged.set('Origin', origin);
  if (cookie) merged.set('Cookie', cookie);
  return new Request(`${ORIGIN}${path}`, { ...rest, headers: merged });
}

export function sentHeaders(spy: ReturnType<typeof stubFetch>, index = 0): Headers {
  const init = spy.mock.calls[index]?.[1];
  return new Headers(init?.headers);
}

export function sentText(spy: ReturnType<typeof stubFetch>, index = 0): string {
  const body = spy.mock.calls[index]?.[1]?.body;
  if (typeof body !== 'string') throw new Error('Corps transmis absent ou inattendu.');
  return body;
}

export function sentBody(spy: ReturnType<typeof stubFetch>, index = 0): string {
  const body = spy.mock.calls[index]?.[1]?.body;
  if (!(body instanceof ArrayBuffer)) throw new Error('Corps transmis absent ou inattendu.');
  return Buffer.from(body).toString('utf8');
}

export function endlessBody(chunkBytes: number): { body: ReadableStream<Uint8Array>; pulled: () => number } {
  let pulls = 0;
  const chunk = new Uint8Array(chunkBytes).fill(97);
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls += 1;
      controller.enqueue(chunk);
    },
  });
  return { body, pulled: () => pulls };
}

export function chunkedBody(parts: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) controller.enqueue(encoder.encode(part));
      controller.close();
    },
  });
}

export const STREAMING = { duplex: 'half' } as const;

import { clientIp } from './clientIp';
import type { ServerEnv } from './env';

const TIMEOUT_MS = 60_000;

export function upstreamHeaders(env: ServerEnv, request: Request, extra: HeadersInit = {}): Headers {
  const headers = new Headers({ Accept: 'application/json' });
  for (const [name, value] of new Headers(extra)) headers.set(name, value);
  headers.set('X-Console-Relay-Key', env.CONSOLE_RELAY_KEY);
  headers.delete('X-Console-Client-Ip');
  const ip = clientIp(request, env.CONSOLE_TRUSTED_PROXY_HOPS);
  if (ip) headers.set('X-Console-Client-Ip', ip);
  return headers;
}

export async function callApi(env: ServerEnv, path: string, init: RequestInit): Promise<Response | null> {
  try {
    return await fetch(`${env.CONSOLE_API_URL}${path}`, {
      ...init,
      cache: 'no-store',
      redirect: 'manual',
      credentials: 'omit',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return null;
  }
}

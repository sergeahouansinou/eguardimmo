import type { ServerEnv } from './env';

const TIMEOUT_MS = 60_000;

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

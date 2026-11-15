import { createApiClient } from '@eguardimmo/api';
import { describe, expect, it, vi } from 'vitest';
import { LOGIN_LOCK_SECONDS } from '../schemas';
import { createApiAuth } from './auth';

const INPUT = { email: 'ines@eguardimmo.fr', password: 'un-mot-de-passe-long', code: '123 456' };

function auth(handler: (url: string, init: RequestInit) => Response) {
  const fetchImpl = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    return Promise.resolve(handler(url, init ?? {}));
  });
  return { fetchImpl, api: createApiAuth(createApiClient({ baseUrl: 'http://localhost:3050', fetchImpl, readCookie: () => 'x' })) };
}

describe('connexion API de la console', () => {
  it('envoie les identifiants à /session et reconnaît le succès', async () => {
    const { api, fetchImpl } = auth(() => new Response(null, { status: 204 }));
    await expect(api.login(INPUT)).resolves.toEqual({ status: 'ok' });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://localhost:3050/session');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ email: 'ines@eguardimmo.fr', password: 'un-mot-de-passe-long', code: '123456' }));
  });

  it('traduit un 422 en identifiants invalides et un 429 en blocage', async () => {
    const invalid = auth(() => new Response('{}', { status: 422, headers: { 'Content-Type': 'application/problem+json' } }));
    await expect(invalid.api.login(INPUT)).resolves.toEqual({ status: 'invalid' });

    const locked = auth(() => new Response('{}', { status: 429, headers: { 'Retry-After': '120' } }));
    await expect(locked.api.login(INPUT)).resolves.toEqual({ status: 'locked', retryAfterSeconds: 120 });

    const noDelay = auth(() => new Response('{}', { status: 429 }));
    await expect(noDelay.api.login(INPUT)).resolves.toEqual({ status: 'locked', retryAfterSeconds: LOGIN_LOCK_SECONDS });
  });

  it('refuse un code mal formé sans interroger le serveur', async () => {
    const { api, fetchImpl } = auth(() => new Response(null, { status: 204 }));
    await expect(api.login({ ...INPUT, code: '12' })).resolves.toEqual({ status: 'invalid' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('laisse remonter une panne technique', async () => {
    const { api } = auth(() => new Response('{}', { status: 502 }));
    await expect(api.login(INPUT)).rejects.toMatchObject({ status: 502 });
  });

  it('appelle DELETE /session à la déconnexion et signale l’échec', async () => {
    const ok = auth(() => new Response(null, { status: 204 }));
    await expect(ok.api.signOut()).resolves.toBeUndefined();
    const [url, init] = ok.fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect([url, init.method]).toEqual(['http://localhost:3050/session', 'DELETE']);

    const failed = auth(() => new Response('{}', { status: 502 }));
    await expect(failed.api.signOut()).rejects.toMatchObject({ status: 502 });
  });
});

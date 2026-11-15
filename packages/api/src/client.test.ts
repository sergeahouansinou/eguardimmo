import { describe, expect, it, vi } from 'vitest';
import { ApiError, ApiUnreachableError } from './errors';
import { buildUrl, createApiClient } from './client';
import { findOrganization } from './profiles';

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

describe('client API', () => {
  it('construit les URL sans paramètres vides', () => {
    expect(buildUrl('https://api.test', '/api/v1/x', { a: 'b', vide: '', nul: null, n: 2 })).toBe('https://api.test/api/v1/x?a=b&n=2');
  });

  it('récupère le cookie CSRF avant une écriture et l’envoie en en-tête', async () => {
    let cookie: string | null = null;
    const fetchImpl = vi.fn((url: string) => {
      if (url.endsWith('/sanctum/csrf-cookie')) {
        cookie = 'jeton%3D';
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(json(201, { data: { id: '1' } }));
    });
    const client = createApiClient({ baseUrl: 'https://api.test', fetchImpl: fetchImpl as unknown as typeof fetch, readCookie: () => cookie });

    await expect(client.post('/api/v1/organizations', { name: 'A' })).resolves.toEqual({ data: { id: '1' } });
    const [, init] = fetchImpl.mock.calls[1] as unknown as [string, RequestInit];
    expect(init.credentials).toBe('include');
    expect((init.headers as Record<string, string>)['X-XSRF-TOKEN']).toBe('jeton%3D');
    expect(init.body).toBe('{"name":"A"}');
  });

  it('traduit un problème RFC 9457 en ApiError', async () => {
    const client = createApiClient({
      baseUrl: 'https://api.test',
      fetchImpl: () => Promise.resolve(json(409, { code: 'already_member', title: 'Déjà membre', detail: 'Cette adresse e-mail est déjà membre ou invitée.' })),
      readCookie: () => 'x',
    });

    const error = await client.post('/api/v1/org/o/members', {}).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'already_member', message: 'Cette adresse e-mail est déjà membre ou invitée.' });
  });

  it('expose les erreurs de champ et le délai de nouvelle tentative', async () => {
    const client = createApiClient({
      baseUrl: 'https://api.test',
      fetchImpl: () => Promise.resolve(json(429, { errors: { email: ['Trop de tentatives.'] } }, { 'Retry-After': '30' })),
      readCookie: () => 'x',
    });

    const error = (await client.post('/x').catch((caught: unknown) => caught)) as ApiError;
    expect(error.firstFieldError()).toBe('Trop de tentatives.');
    expect(error.retryAfterSeconds).toBe(30);
  });

  it('signale un serveur injoignable sans le confondre avec une réponse', async () => {
    const client = createApiClient({ baseUrl: 'https://api.test', fetchImpl: () => Promise.reject(new TypeError('Failed to fetch')) });
    await expect(client.get('/x')).rejects.toBeInstanceOf(ApiUnreachableError);
  });

  it('trouve l’organisation du bon type dans les profils', async () => {
    const client = createApiClient({
      baseUrl: 'https://api.test',
      fetchImpl: () =>
        Promise.resolve(
          json(200, {
            data: [
              { space: 'operator', label: 'Console', meta: {} },
              { space: 'organization', label: 'Agence du Port', meta: { organization: '01934f6e-0000-7000-8000-00000000000a', kind: 'agency', role: 'owner' } },
            ],
          }),
        ),
    });

    await expect(findOrganization(client, 'agency')).resolves.toEqual({ organization: '01934f6e-0000-7000-8000-00000000000a', kind: 'agency', role: 'owner', name: 'Agence du Port' });
    await expect(findOrganization(client, 'individual')).resolves.toBeNull();
  });
});

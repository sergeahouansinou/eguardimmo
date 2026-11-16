import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleRelay } from './relay';
import { API, RELAY_KEY, STREAMING, call, chunkedBody, endlessBody, json, sentBody, sentHeaders, sessionCookieHeader, stubFetch, stubServerEnv } from './testing/helpers';

const get = (path: string, init: Parameters<typeof call>[1] = {}) => call(path, { cookie: sessionCookieHeader('5|operateur'), ...init });

describe('relais /api/v1/console/*', () => {
  beforeEach(() => {
    stubServerEnv();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('répond 401 RFC 9457 sans session, sans appeler l’API', async () => {
    const api = stubFetch(() => json(200, {}));
    const response = await handleRelay(call('/api/v1/console/me'));
    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).toBe('application/problem+json');
    expect(await response.json()).toMatchObject({ status: 401, code: 'unauthenticated', title: expect.any(String) as unknown, type: expect.any(String) as unknown });
    expect(api).not.toHaveBeenCalled();
  });

  it('répond 401 et efface un cookie expiré ou altéré', async () => {
    const api = stubFetch(() => json(200, {}));
    const expired = await handleRelay(call('/api/v1/console/me', { cookie: sessionCookieHeader('t', Date.now() - 1) }));
    expect(expired.status).toBe(401);
    expect(expired.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(api).not.toHaveBeenCalled();
  });

  it('ajoute le Bearer, retire les cookies et les en-têtes d’origine, garde ceux de la liste blanche', async () => {
    const api = stubFetch(() => json(200, { data: [] }));
    const response = await handleRelay(
      get('/api/v1/console/support/tickets?page=2&per_page=10', {
        headers: {
          Authorization: 'Bearer pirate',
          'X-XSRF-TOKEN': 'x',
          'X-Forwarded-For': '6.6.6.6',
          Referer: 'http://localhost:3050/aide',
          'Accept-Language': 'fr-FR',
          'If-None-Match': '"abc"',
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(api.mock.calls[0]?.[0]).toBe(`${API}/api/v1/console/support/tickets?page=2&per_page=10`);
    const sent = sentHeaders(api);
    expect(sent.get('authorization')).toBe('Bearer 5|operateur');
    expect(sent.get('cookie')).toBeNull();
    expect(sent.get('origin')).toBeNull();
    expect(sent.get('referer')).toBeNull();
    expect(sent.get('x-xsrf-token')).toBeNull();
    expect(sent.get('x-forwarded-for')).toBeNull();
    expect(sent.get('accept')).toBe('application/json');
    expect(sent.get('accept-language')).toBe('fr-FR');
    expect(sent.get('if-none-match')).toBe('"abc"');
    expect(api.mock.calls[0]?.[1]).toMatchObject({ redirect: 'manual', credentials: 'omit' });
  });

  it('envoie la clé de relais et l’IP calculée côté serveur sur chaque appel relayé', async () => {
    const api = stubFetch(() => json(200, {}));
    await handleRelay(get('/api/v1/console/me', { headers: { 'X-Forwarded-For': '6.6.6.6, 203.0.113.7' } }));
    await handleRelay(get('/api/v1/console/support/tickets/1/messages', { method: 'POST', body: '{}', headers: { 'X-Forwarded-For': '198.51.100.9' } }));
    for (const index of [0, 1]) expect(sentHeaders(api, index).get('x-console-relay-key')).toBe(RELAY_KEY);
    expect(sentHeaders(api, 0).get('x-console-client-ip')).toBe('203.0.113.7');
    expect(sentHeaders(api, 1).get('x-console-client-ip')).toBe('198.51.100.9');
  });

  it('ignore la clé de relais et l’IP envoyées par le navigateur', async () => {
    const api = stubFetch(() => json(200, {}));
    await handleRelay(get('/api/v1/console/me', { headers: { 'X-Console-Client-Ip': '9.9.9.9', 'X-Console-Relay-Key': 'pirate', 'X-Forwarded-For': '203.0.113.7' } }));
    await handleRelay(get('/api/v1/console/me', { headers: { 'X-Console-Client-Ip': '9.9.9.9', 'X-Console-Relay-Key': 'pirate' } }));
    expect(sentHeaders(api, 0).get('x-console-client-ip')).toBe('203.0.113.7');
    expect(sentHeaders(api, 0).get('x-console-relay-key')).toBe(RELAY_KEY);
    expect(sentHeaders(api, 1).get('x-console-client-ip')).toBeNull();
    expect(sentHeaders(api, 1).get('x-console-relay-key')).toBe(RELAY_KEY);
  });

  it('refuse les chemins hors des segments sûrs', async () => {
    const api = stubFetch(() => json(200, {}));
    for (const path of ['/api/v1/console/%2e%2e/me', '/api/v1/console/a%2fb', '/api/v1/console/a//b', '/api/v1/console/', '/api/v1/console/.env', '/api/v1/console/http:%2f%2fevil']) {
      const response = await handleRelay(get(path));
      expect([400, 404]).toContain(response.status);
    }
    expect(api).not.toHaveBeenCalled();
  });

  it('refuse un chemin hors de console/ et la gestion du jeton par le relais', async () => {
    const api = stubFetch(() => json(200, {}));
    expect((await handleRelay(get('/api/v1/me'))).status).toBe(400);
    expect((await handleRelay(get('/api/v1/console/auth/token', { method: 'DELETE' }))).status).toBe(403);
    expect(api).not.toHaveBeenCalled();
  });

  it('refuse les écritures sans Origin de la console (403) mais laisse passer les lectures', async () => {
    const api = stubFetch(() => json(200, {}));
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const absent = await handleRelay(get('/api/v1/console/support/tickets/1', { method, origin: null }));
      const foreign = await handleRelay(get('/api/v1/console/support/tickets/1', { method, origin: 'https://evil.example' }));
      expect([absent.status, foreign.status]).toEqual([403, 403]);
    }
    expect(api).not.toHaveBeenCalled();
    expect((await handleRelay(get('/api/v1/console/me', { origin: null }))).status).toBe(200);
  });

  it('transmet un corps JSON et un corps multipart tels quels', async () => {
    const api = stubFetch(() => json(201, { data: { id: '1' } }));
    const payload = JSON.stringify({ body: 'Bonjour' });
    await handleRelay(get('/api/v1/console/support/tickets/1/messages', { method: 'POST', body: payload, headers: { 'Content-Type': 'application/json' } }));
    expect(api.mock.calls[0]?.[1]?.method).toBe('POST');
    expect(sentBody(api, 0)).toBe(payload);
    expect(sentHeaders(api).get('content-type')).toBe('application/json');

    const boundary = '----limite-test';
    const form = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="body"',
      '',
      'Voir pièce jointe',
      `--${boundary}`,
      'Content-Disposition: form-data; name="attachments[]"; filename="contrat.pdf"',
      'Content-Type: application/pdf',
      '',
      '%PDF-1.4',
      `--${boundary}--`,
      '',
    ].join('\r\n');
    const multipart = new Request('http://localhost:3050/api/v1/console/support/tickets/1/messages', {
      method: 'POST',
      body: form,
      headers: { Origin: 'http://localhost:3050', Cookie: sessionCookieHeader(), 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    });
    await handleRelay(multipart);
    expect(sentHeaders(api, 1).get('content-type')).toBe(`multipart/form-data; boundary=${boundary}`);
    expect(sentBody(api, 1)).toBe(form);
  });

  it('refuse un corps trop volumineux avant de l’envoyer', async () => {
    const api = stubFetch(() => json(200, {}));
    const response = await handleRelay(get('/api/v1/console/support/tickets/1/messages', { method: 'POST', body: '{}', headers: { 'Content-Length': String(60 * 1024 * 1024) } }));
    expect(response.status).toBe(413);
    expect(api).not.toHaveBeenCalled();
  });

  it('abandonne la lecture d’un corps chunked sans Content-Length qui dépasse le plafond', async () => {
    const api = stubFetch(() => json(200, {}));
    const { body, pulled } = endlessBody(1024 * 1024);
    const response = await handleRelay(get('/api/v1/console/support/tickets/1/messages', { method: 'POST', body, ...STREAMING }));
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ code: 'payload_too_large', status: 413 });
    expect(api).not.toHaveBeenCalled();
    expect(pulled()).toBeLessThan(60);
  });

  it('accepte un corps chunked sous le plafond', async () => {
    const api = stubFetch(() => json(201, {}));
    const response = await handleRelay(get('/api/v1/console/support/tickets/1/messages', { method: 'POST', body: chunkedBody(['{"body":', '"Bonjour"}']), ...STREAMING }));
    expect(response.status).toBe(201);
    expect(sentBody(api)).toBe('{"body":"Bonjour"}');
  });

  it('renvoie statut, type, Content-Disposition, Retry-After et flux binaire sans mise en cache', async () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x00, 0xff]);
    stubFetch(
      () =>
        new Response(bytes, {
          status: 200,
          headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="contrat.pdf"', 'Set-Cookie': 'laravel_session=x', 'Cache-Control': 'public, max-age=600', Server: 'nginx' },
        }),
    );
    const response = await handleRelay(get('/api/v1/console/support/attachments/0194a2e0-0000-7000-8000-000000000001'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="contrat.pdf"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('server')).toBeNull();
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  });

  it('neutralise un contenu actif (HTML, SVG) renvoyé par l’API', async () => {
    stubFetch(() => new Response('<script>alert(1)</script>', { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
    const response = await handleRelay(get('/api/v1/console/support/attachments/abc'));
    expect(response.headers.get('content-type')).toBe('application/octet-stream');
    expect(response.headers.get('content-disposition')).toBe('attachment');
  });

  it('relaie les erreurs de l’API (422, 429 avec Retry-After, 404) avec leur corps', async () => {
    stubFetch(() => json(429, { code: 'too_many_requests' }, { 'Retry-After': '30', 'Content-Type': 'application/problem+json' }));
    const limited = await handleRelay(get('/api/v1/console/activity'));
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('30');
    expect(await limited.json()).toMatchObject({ code: 'too_many_requests' });

    stubFetch(() => json(422, { errors: { reason: ['Trop court.'] } }));
    expect((await handleRelay(get('/api/v1/console/support/tickets/1/access', { method: 'POST', body: '{}' }))).status).toBe(422);
  });

  it('efface le cookie quand l’API répond 401 (jeton révoqué ou expiré)', async () => {
    stubFetch(() => json(401, { code: 'unauthenticated' }));
    const response = await handleRelay(get('/api/v1/console/me'));
    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('ne suit pas une redirection de l’API et répond 502', async () => {
    stubFetch(() => new Response(null, { status: 302, headers: { Location: 'https://evil.example/' } }));
    const response = await handleRelay(get('/api/v1/console/me'));
    expect(response.status).toBe(502);
    expect(response.headers.get('location')).toBeNull();
  });

  it('répond 503 quand l’API est injoignable', async () => {
    stubFetch(() => {
      throw new TypeError('fetch failed');
    });
    const response = await handleRelay(get('/api/v1/console/me'));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('fetch failed');
  });
});

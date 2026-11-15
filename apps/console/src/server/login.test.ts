import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleLogin, handleLogout } from './login';
import { openSession, SESSION_COOKIE } from './session';
import { API, KEY, RELAY_KEY, call, json, sentHeaders, sentText, sessionCookieHeader, stubFetch, stubServerEnv } from './testing/helpers';

const CREDENTIALS = { email: 'ines@eguardimmo.fr', password: 'un-mot-de-passe-long', code: '123456' };

function login(body: unknown = CREDENTIALS, init: Parameters<typeof call>[1] = {}): Request {
  return call('/session', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' }, ...init });
}

describe('POST /session', () => {
  beforeEach(() => {
    stubServerEnv();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('pose le cookie de session et renvoie 204 quand l’API délivre un jeton', async () => {
    const api = stubFetch(() => json(201, { data: { token: '7|jeton-secret' } }));
    const before = Date.now();
    const response = await handleLogin(login());

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(response.headers.get('cache-control')).toBe('no-store');
    const cookie = response.headers.get('set-cookie') ?? '';
    expect(cookie.startsWith(`${SESSION_COOKIE}=`)).toBe(true);
    for (const attribute of ['Max-Age=14400', 'Path=/', 'HttpOnly', 'Secure', 'SameSite=Strict']) expect(cookie).toContain(attribute);
    expect(cookie).not.toContain('Domain');
    expect(cookie).not.toContain('jeton-secret');

    const sealed = cookie.slice(`${SESSION_COOKIE}=`.length).split(';')[0] ?? '';
    const session = openSession(sealed, KEY);
    expect(session?.token).toBe('7|jeton-secret');
    expect(session?.expiresAt).toBeGreaterThanOrEqual(before + 14_400_000);

    expect(api.mock.calls[0]?.[0]).toBe(`${API}/api/v1/console/auth/token`);
    expect(sentText(api)).toBe(JSON.stringify(CREDENTIALS));
    expect(sentHeaders(api).get('cookie')).toBeNull();
  });

  it('transmet la clé de relais et l’IP du client pour la limite de débit du backend', async () => {
    const api = stubFetch(() => json(201, { data: { token: 't' } }));
    await handleLogin(login(CREDENTIALS, { headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '6.6.6.6, 203.0.113.7' } }));
    expect(sentHeaders(api).get('x-console-relay-key')).toBe(RELAY_KEY);
    expect(sentHeaders(api).get('x-console-client-ip')).toBe('203.0.113.7');
  });

  it('respecte CONSOLE_TOKEN_TTL_MINUTES', async () => {
    vi.stubEnv('CONSOLE_TOKEN_TTL_MINUTES', '30');
    stubFetch(() => json(201, { data: { token: 't' } }));
    expect((await handleLogin(login())).headers.get('set-cookie')).toContain('Max-Age=1800');
  });

  it('relaie un 422 sans cookie et sans détail de l’API', async () => {
    stubFetch(() => json(422, { message: 'Compte verrouillé pour ines@eguardimmo.fr', errors: { email: ['Ces identifiants ne correspondent pas.'] } }));
    const response = await handleLogin(login());

    expect(response.status).toBe(422);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('content-type')).toBe('application/problem+json');
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ status: 422, code: 'validation_failed', errors: { email: ['Identifiants ou code invalides.'] } });
    expect(JSON.stringify(body)).not.toContain('verrouillé');
  });

  it('relaie un 429 avec Retry-After', async () => {
    stubFetch(() => json(429, { code: 'too_many_requests' }, { 'Retry-After': '120' }));
    const response = await handleLogin(login());

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('120');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(await response.json()).toMatchObject({ code: 'too_many_requests', retry_after: 120 });
  });

  it('refuse un POST sans Origin ou depuis une autre origine, sans appeler l’API', async () => {
    const api = stubFetch(() => json(201, { data: { token: 't' } }));
    expect((await handleLogin(login(CREDENTIALS, { origin: null }))).status).toBe(403);
    expect((await handleLogin(login(CREDENTIALS, { origin: 'https://evil.example' }))).status).toBe(403);
    expect(api).not.toHaveBeenCalled();
  });

  it('refuse un corps incomplet ou illisible sans appeler l’API', async () => {
    const api = stubFetch(() => json(201, { data: { token: 't' } }));
    const missing = await handleLogin(login({ email: 'ines@eguardimmo.fr', password: 'x' }));
    expect(missing.status).toBe(422);
    expect(await missing.json()).toMatchObject({ errors: { code: expect.any(Array) as unknown } });
    expect((await handleLogin(call('/session', { method: 'POST', body: 'pas du json' }))).status).toBe(400);
    expect((await handleLogin(login({ ...CREDENTIALS, password: 'x'.repeat(5000) }))).status).toBe(413);
    expect(api).not.toHaveBeenCalled();
  });

  it('transmet un code de secours à la place du code TOTP', async () => {
    const api = stubFetch(() => json(201, { data: { token: 't' } }));
    await handleLogin(login({ email: CREDENTIALS.email, password: CREDENTIALS.password, recovery_code: 'abcd-efgh' }));
    expect(JSON.parse(sentText(api))).toEqual({ email: CREDENTIALS.email, password: CREDENTIALS.password, recovery_code: 'abcd-efgh' });
  });

  it('signale une API injoignable (503) ou incohérente (502) sans cookie', async () => {
    stubFetch(() => {
      throw new TypeError('fetch failed');
    });
    const down = await handleLogin(login());
    expect(down.status).toBe(503);
    expect(down.headers.get('set-cookie')).toBeNull();

    stubFetch(() => json(201, { data: {} }));
    expect((await handleLogin(login())).status).toBe(502);
    stubFetch(() => json(500, { message: 'SQLSTATE[HY000] détail interne' }));
    const failed = await handleLogin(login());
    expect(failed.status).toBe(502);
    expect(await failed.text()).not.toContain('SQLSTATE');
  });

  it('répond 503 quand la configuration serveur manque', async () => {
    vi.stubEnv('CONSOLE_SESSION_SECRET', '');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const api = stubFetch(() => json(201, { data: { token: 't' } }));
    expect((await handleLogin(login())).status).toBe(503);
    expect(api).not.toHaveBeenCalled();
    expect(String(error.mock.calls[0]?.[0])).toContain('CONSOLE_SESSION_SECRET');
    error.mockRestore();
  });
});

describe('DELETE /session', () => {
  beforeEach(() => {
    stubServerEnv();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const logout = (init: Parameters<typeof call>[1] = {}) => call('/session', { method: 'DELETE', cookie: sessionCookieHeader('9|a-revoquer'), ...init });

  it('révoque le jeton côté API puis efface le cookie', async () => {
    const api = stubFetch(() => new Response(null, { status: 204 }));
    const response = await handleLogout(logout());

    expect(response.status).toBe(204);
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(api.mock.calls[0]?.[0]).toBe(`${API}/api/v1/console/auth/token`);
    expect(api.mock.calls[0]?.[1]?.method).toBe('DELETE');
    expect(sentHeaders(api).get('authorization')).toBe('Bearer 9|a-revoquer');
  });

  it('efface le cookie et signale l’échec quand la révocation échoue', async () => {
    stubFetch(() => json(500, {}));
    const response = await handleLogout(logout());
    expect(response.status).toBe(502);
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(await response.json()).toMatchObject({ code: 'revocation_failed' });

    stubFetch(() => {
      throw new TypeError('fetch failed');
    });
    const unreachable = await handleLogout(logout());
    expect(unreachable.status).toBe(502);
    expect(unreachable.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('considère un jeton déjà invalide (401) comme révoqué', async () => {
    stubFetch(() => json(401, {}));
    const response = await handleLogout(logout());
    expect(response.status).toBe(204);
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('efface le cookie sans appeler l’API quand il n’y a pas de session valide', async () => {
    const api = stubFetch(() => new Response(null, { status: 204 }));
    const response = await handleLogout(logout({ cookie: `${SESSION_COOKIE}=corrompu` }));
    expect(response.status).toBe(204);
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(api).not.toHaveBeenCalled();
  });

  it('refuse une origine étrangère sans rien révoquer', async () => {
    const api = stubFetch(() => new Response(null, { status: 204 }));
    expect((await handleLogout(logout({ origin: 'https://evil.example' }))).status).toBe(403);
    expect(api).not.toHaveBeenCalled();
  });
});

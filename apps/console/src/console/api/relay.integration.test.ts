import { createApiClient } from '@eguardimmo/api';
import { createConsoleSupportApiSource } from '@eguardimmo/messagerie';
import { consoleDetailResponse, consoleListResponse, consoleTicketFixture, requesterMessageFixture, consoleGrantFixture } from '@eguardimmo/messagerie/support-console-testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleRelay } from '@/server/relay';
import { API, ORIGIN, RELAY_KEY, json, sessionCookieHeader, stubFetch, stubServerEnv } from '@/server/testing/helpers';
import { activityApi } from './activity';
import { requestUrl } from '../../../test/requestUrl';
import * as api from './fixtures';

const TOKEN = '7|jeton-operateur-secret';
const TICKET = '3a7e9c15-4b2d-4e8f-a6c1-9b0d2e4f6a73';
const PIECE = 'a1b2c3d4-0000-4000-8000-00000000a001';

const ticket = consoleTicketFixture({ id: TICKET, reference: 'SUP-2026-00001', subject: 'Quittance introuvable' });
const ticketDetail = consoleDetailResponse(ticket, [requesterMessageFixture({ attachments: [{ id: PIECE, name: 'quittance.pdf', mime_type: 'application/pdf', size_bytes: 20480 }] })]);

const consoleGrant = consoleGrantFixture();
const supportSource = (client: ReturnType<typeof createApiClient>) =>
  createConsoleSupportApiSource({ client, operatorId: () => Promise.resolve(api.IDS.me) });
const QUERY = { status: 'open', priority: 'high', assignee: 'none', space: 'all', organization: null, search: '', page: 1, perPage: 20 } as const;

interface Upstream {
  url: string;
  init: RequestInit;
}

function browser(session: string | null = sessionCookieHeader(TOKEN)) {
  const seen: { url: string; headers: Headers }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    seen.push({ url: requestUrl(input), headers: new Headers(headers) });
    headers.set('Origin', ORIGIN);
    if (session !== null) headers.set('Cookie', session);
    return handleRelay(new Request(requestUrl(input), { ...init, headers }));
  };
  const client = createApiClient({ baseUrl: ORIGIN, fetchImpl, readCookie: () => 'xsrf' });
  return { client, fetchImpl, seen };
}

function upstreamCalls(spy: ReturnType<typeof stubFetch>): Upstream[] {
  return spy.mock.calls.map(([url, init]) => ({ url, init: init ?? {} }));
}

beforeEach(() => {
  stubServerEnv();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('console → relais → API', () => {
  it('lit la liste des tickets : jeton ajouté côté serveur seulement, jamais visible du navigateur', async () => {
    const upstream = stubFetch(() => json(200, consoleListResponse([ticket])));
    const { client, seen } = browser();

    const list = await supportSource(client).listTickets(QUERY, undefined);

    expect(list.items[0]?.reference).toBe('SUP-2026-00001');
    const [call] = upstreamCalls(upstream);
    expect(call?.url).toBe(`${API}/api/v1/console/support/tickets?status=open&priority=high&assignee=none&page=1&per_page=20`);
    const sent = new Headers(call?.init.headers);
    expect(sent.get('authorization')).toBe(`Bearer ${TOKEN}`);
    expect(sent.get('x-console-relay-key')).toBe(RELAY_KEY);
    expect(seen[0]?.url.startsWith(ORIGIN)).toBe(true);
    for (const request of seen) {
      expect(request.headers.get('authorization')).toBeNull();
      expect(JSON.stringify([...request.headers])).not.toContain(TOKEN);
    }
  });

  it('modifie un ticket par PATCH JSON et répond avec le détail', async () => {
    const upstream = stubFetch(() => json(200, ticketDetail));
    const { client } = browser();

    await supportSource(client).updateTicket(TICKET, { status: 'resolved', assigneeId: null });

    const [call] = upstreamCalls(upstream);
    expect(call?.url).toBe(`${API}/api/v1/console/support/tickets/${TICKET}`);
    expect(call?.init.method).toBe('PATCH');
    expect(Buffer.from(call?.init.body as ArrayBuffer).toString('utf8')).toBe('{"status":"resolved","assignee_id":null}');
  });

  it('envoie une réponse avec pièce jointe en multipart jusqu’à l’API', async () => {
    const upstream = stubFetch(() => json(200, ticketDetail));
    const { client } = browser();

    await supportSource(client).postMessage(TICKET, { body: 'Bien reçu', internal: true, clientId: '0193a5e1-0000-7000-8000-0000000000c1', files: [new File(['%PDF'], 'preuve.pdf', { type: 'application/pdf' })] });

    const [call] = upstreamCalls(upstream);
    expect(call?.url).toBe(`${API}/api/v1/console/support/tickets/${TICKET}/messages`);
    expect(new Headers(call?.init.headers).get('content-type')).toMatch(/^multipart\/form-data; boundary=/);
    const body = Buffer.from(call?.init.body as ArrayBuffer).toString('utf8');
    expect(body).toContain('name="body"');
    expect(body).toContain('Bien reçu');
    expect(body).toContain('name="internal"');
    expect(body).toContain('name="client_id"');
    expect(body).toMatch(/name="attachments\[\]"; filename="[^"]+"\r\nContent-Type: application\/pdf/);
  });

  it('demande l’accès de l’organisation par POST JSON', async () => {
    const upstream = stubFetch(() => json(201, { data: consoleGrant }));
    const { client } = browser();

    await supportSource(client).requestAccess(TICKET, { reason: 'Vérifier la quittance manquante', scopes: ['team'], durationHours: 24 });

    const [call] = upstreamCalls(upstream);
    expect(call?.url).toBe(`${API}/api/v1/console/support/tickets/${TICKET}/access-requests`);
    expect(Buffer.from(call?.init.body as ArrayBuffer).toString('utf8')).toBe('{"reason":"Vérifier la quittance manquante","scopes":["team"],"duration_hours":24}');
  });

  it('relaie l’accès d’urgence, sa revue et la lecture d’équipe, avec le refus d’un accès manquant', async () => {
    const upstream = stubFetch((url) => {
      if (url.endsWith('/team')) return json(403, { type: 'about:blank', title: 'Accès du support requis', status: 403, code: 'support_access_required', detail: 'Aucun accès valide ne couvre cette ressource.' });
      return json(201, { data: consoleGrant });
    });
    const { client } = browser();
    const source = supportSource(client);

    await source.openEmergency(TICKET, { reason: 'Compte compromis', basis: 'security_incident' });
    await source.reviewGrant(consoleGrant.id);
    await expect(source.organizationTeam(consoleGrant.organization_id ?? '')).rejects.toMatchObject({ status: 403, code: 'support_access_required' });

    expect(upstreamCalls(upstream).map((call) => [call.init.method, call.url])).toEqual([
      ['POST', `${API}/api/v1/console/support/tickets/${TICKET}/emergency-access`],
      ['POST', `${API}/api/v1/console/support/access/${consoleGrant.id}/review`],
      ['GET', `${API}/api/v1/console/organizations/${consoleGrant.organization_id ?? ''}/team`],
    ]);
  });

  it('télécharge une pièce jointe sans laisser passer les en-têtes sensibles du serveur', async () => {
    const headers = new Headers({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="quittance.pdf"',
      'Set-Cookie': 'laravel_session=secret; HttpOnly',
      'X-Request-Id': 'req-interne',
      Server: 'nginx/1.25',
      'X-Powered-By': 'PHP/8.4',
      Authorization: 'Bearer renvoye',
    });
    stubFetch(() => new Response('%PDF-1.7', { status: 200, headers }));
    const { client, fetchImpl } = browser();

    const response = await fetchImpl(client.url(`/api/v1/console/support/attachments/${PIECE}`), { credentials: 'include' });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="quittance.pdf"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    for (const name of ['set-cookie', 'x-request-id', 'server', 'x-powered-by', 'authorization']) expect(response.headers.get(name)).toBeNull();
    expect(await response.text()).toBe('%PDF-1.7');
  });

  it('force en téléchargement un contenu actif renvoyé par la pièce', async () => {
    stubFetch(() => new Response('<script>1</script>', { status: 200, headers: { 'Content-Type': 'text/html' } }));
    const { client, fetchImpl } = browser();

    const response = await fetchImpl(client.url(`/api/v1/console/support/attachments/${PIECE}`));

    expect(response.headers.get('content-type')).toBe('application/octet-stream');
    expect(response.headers.get('content-disposition')).toBe('attachment');
  });

  it('refuse sans session : 401, aucun appel à l’API', async () => {
    const upstream = stubFetch(() => json(200, {}));
    const { client } = browser(null);

    await expect(activityApi(client).list({})).rejects.toMatchObject({ status: 401 });
    expect(upstream).not.toHaveBeenCalled();
  });

  it('relaie la liste du journal d’activité avec ses filtres', async () => {
    const upstream = stubFetch(() => json(200, api.activityListResponse));
    const { client } = browser();

    await activityApi(client).list({ action: 'lease.', cursor: 'abc', perPage: 25 });

    expect(upstreamCalls(upstream)[0]?.url).toBe(`${API}/api/v1/console/activity?action=lease.&per_page=25&cursor=abc`);
  });

  it('refuse d’atteindre l’authentification par le relais', async () => {
    const upstream = stubFetch(() => json(200, {}));
    const { client } = browser();

    await expect(client.get('/api/v1/console/auth/token')).rejects.toMatchObject({ status: 403 });
    expect(upstream).not.toHaveBeenCalled();
  });
});

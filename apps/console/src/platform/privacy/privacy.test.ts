import { ApiError, createApiClient } from '@eguardimmo/api';
import { describe, expect, it } from 'vitest';
import { fakeServer, json } from '../../../test/platform';
import type { Responder } from '../../../test/platform';
import { UnexpectedResponseError, describeProblem } from '../errors';
import { problem } from '../fixtures';
import { privacyApi } from './privacy';
import * as f from './privacyFixtures';

function setup(respond: Responder) {
  const server = fakeServer(respond);
  const client = createApiClient({ baseUrl: 'https://console.test', fetchImpl: server.fetchMock, readCookie: () => 'x' });
  return { ...server, api: privacyApi(client) };
}

describe('demandes RGPD', () => {
  it('liste avec filtres, curseur et compteurs', async () => {
    const { api, requests } = setup(() => json(200, f.listResponse(undefined, { has_more: true, next_cursor: 'c2', open_count: 7, overdue_count: 2 })));
    const page = await api.list({ status: 'in_progress', kind: 'erasure', overdue: true, cursor: 'c1', perPage: 25 });

    const params = requests[0]?.url.searchParams;
    expect(requests[0]?.url.pathname).toBe('/api/v1/console/privacy-requests');
    expect([params?.get('status'), params?.get('kind'), params?.get('overdue'), params?.get('cursor'), params?.get('per_page')]).toEqual(['in_progress', 'erasure', '1', 'c1', '25']);
    expect(page).toMatchObject({ hasMore: true, nextCursor: 'c2', openCount: 7, overdueCount: 2 });
    expect(page.rows[0]).toMatchObject({
      kind: 'access',
      channel: 'account',
      status: 'received',
      deadline: '2026-12-10T09:00:00+00:00',
      requester: { accountId: f.PRIVACY_IDS.account, name: 'Léa Fontaine', email: 'lea.fontaine@exemple.fr' },
      events: null,
    });
    expect(page.rows[1]).toMatchObject({ overdue: true, forwards: { total: 3, handled: 1 }, exportGenerated: true, exportDownloaded: false });
  });

  it('lit une demande avec son journal de preuve', async () => {
    const { api } = setup(() => json(200, f.detailResponse()));
    const request = await api.get(f.PRIVACY_IDS.request);
    expect(request.events).toEqual([
      { kind: 'received', occurredAt: '2026-11-10T09:00:00+00:00', actorId: f.PRIVACY_IDS.account },
      { kind: 'verified', occurredAt: '2026-11-11T09:00:00+00:00', actorId: f.PRIVACY_IDS.operator },
    ]);
  });

  it('accepte un demandeur sans compte ni nom (demande reçue par courrier)', async () => {
    const letter = f.detailResponse({ channel: 'letter', requester: { account_id: null, name: null, email: null } });
    const { api } = setup(() => json(200, letter));
    expect((await api.get(f.PRIVACY_IDS.request)).requester).toEqual({ accountId: null, name: null, email: null });
  });

  it('saisit une demande reçue hors application avec les champs du serveur', async () => {
    const { api, writes } = setup(() => json(201, f.detailResponse({ channel: 'letter' })));
    await api.record({ kind: 'access', channel: 'letter', requesterEmail: ' lea@exemple.fr ', receivedOn: '2026-11-01' });
    await api.record({ kind: 'erasure', channel: 'email', requesterEmail: 'a@exemple.fr', receivedOn: '' });

    expect(writes()[0]?.url.pathname).toBe('/api/v1/console/privacy-requests');
    expect(writes()[0]?.body).toEqual({ kind: 'access', channel: 'letter', requester_email: 'lea@exemple.fr', received_on: '2026-11-01' });
    expect(writes()[1]?.body).toEqual({ kind: 'erasure', channel: 'email', requester_email: 'a@exemple.fr' });
  });

  it.each([
    ['verify', (api: ReturnType<typeof setup>['api']) => api.verify(f.PRIVACY_IDS.request, 'video_call'), 'verify', { verification_method: 'video_call' }],
    ['extend', (api: ReturnType<typeof setup>['api']) => api.extend(f.PRIVACY_IDS.request, 'complexity'), 'extend', { reason: 'complexity' }],
    ['complete', (api: ReturnType<typeof setup>['api']) => api.complete(f.PRIVACY_IDS.request), 'complete', null],
    ['refuse', (api: ReturnType<typeof setup>['api']) => api.refuse(f.PRIVACY_IDS.request, 'excessive'), 'refuse', { reason: 'excessive' }],
  ] as const)('%s : appelle la bonne route avec le bon corps', async (_name, call, verb, body) => {
    const { api, writes } = setup(() => json(200, f.detailResponse()));
    await call(api);
    expect(writes()[0]?.url.pathname).toBe(`/api/v1/console/privacy-requests/${f.PRIVACY_IDS.request}/${verb}`);
    expect(writes()[0]?.body).toEqual(body);
  });

  it('transmet aux organisations et rapporte le nombre de transmissions', async () => {
    const { api, writes } = setup(() => json(200, { ...f.detailResponse({ forwards: { total: 2, handled: 0 } }), meta: { forwarded: 2 } }));
    const result = await api.forward(f.PRIVACY_IDS.request);
    expect(writes()[0]?.url.pathname).toBe(`/api/v1/console/privacy-requests/${f.PRIVACY_IDS.request}/forward`);
    expect(result.forwarded).toBe(2);
    expect(result.request.forwards).toEqual({ total: 2, handled: 0 });
  });

  it.each([
    ['liste', (api: ReturnType<typeof setup>['api']) => api.list()],
    ['lecture', (api: ReturnType<typeof setup>['api']) => api.get('x')],
    ['transmission', (api: ReturnType<typeof setup>['api']) => api.forward('x')],
  ] as const)('refuse une réponse hors contrat (%s)', async (_name, call) => {
    const { api } = setup(() => json(200, f.listResponse([f.requestData({ kind: 'gossip' })])));
    await expect(call(api)).rejects.toBeInstanceOf(UnexpectedResponseError);
  });

  it.each([
    [401, problem(401, 'unauthenticated', 'Non authentifié'), 'unauthenticated'],
    [403, problem(403, 'operator_role_required', 'Rôle requis'), 'forbidden'],
    [404, problem(404, 'privacy_request_not_found', 'Demande introuvable'), 'not_found'],
    [409, problem(409, 'privacy_request_closed', 'Demande clôturée'), 'conflict'],
    [422, problem(422, 'operator_proof_invalid', 'Code incorrect'), 'invalid'],
  ] as const)('traduit l’erreur %i du serveur', async (status, body, kind) => {
    const { api } = setup(() => json(status, body));
    const error = await api.complete(f.PRIVACY_IDS.request).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(describeProblem(error)).toMatchObject({ kind, code: body.code });
  });

  it('signale la limitation de débit avec le délai', async () => {
    const { api } = setup(() => json(429, problem(429, 'throttled', 'Trop de requêtes'), { 'Retry-After': '30' }));
    const error = await api.list().catch((caught: unknown) => caught);
    expect(describeProblem(error)).toMatchObject({ kind: 'rate_limited', retryAfterSeconds: 30 });
  });
});

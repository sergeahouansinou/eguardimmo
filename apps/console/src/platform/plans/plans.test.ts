import { ApiError, createApiClient } from '@eguardimmo/api';
import { describe, expect, it } from 'vitest';
import { fakeServer, json } from '../../../test/platform';
import type { Responder } from '../../../test/platform';
import { UnexpectedResponseError, describeProblem } from '../errors';
import { problem } from '../fixtures';
import { plansApi } from './plans';
import * as f from './planFixtures';
import { subscriptionsApi } from './subscriptions';

function setup(respond: Responder) {
  const server = fakeServer(respond);
  const client = createApiClient({ baseUrl: 'https://console.test', fetchImpl: server.fetchMock, readCookie: () => 'x' });
  return { ...server, plans: plansApi(client), subscriptions: subscriptionsApi(client) };
}

describe('plans et versions', () => {
  it('liste les plans avec leurs versions, prix et droits', async () => {
    const { plans, requests } = setup(() => json(200, f.plansResponse()));
    const list = await plans.list();

    expect(requests[0]?.url.pathname).toBe('/api/v1/console/plans');
    expect(list.map((plan) => plan.code)).toEqual(['gold', 'silver']);
    const gold = list[0];
    expect(gold?.versions.map((version) => [version.version, version.status])).toEqual([[3, 'draft'], [2, 'published'], [1, 'archived']]);
    expect(gold?.versions[1]?.prices).toEqual([
      { currency: 'CAD', monthlyAmount: 4900, yearlyAmount: 49000 },
      { currency: 'EUR', monthlyAmount: 3500, yearlyAmount: 35000 },
    ]);
    expect(gold?.versions[1]?.entitlements.find((e) => e.feature === 'leases')).toMatchObject({ kind: 'quota', limit: 200, enabled: true });
    expect(gold?.versions[1]?.trialDays).toBe(15);
  });

  it('lit un plan par son code encodé', async () => {
    const { plans, requests } = setup(() => json(200, f.planResponse()));
    expect((await plans.get('gold')).name).toBe('Gold');
    await plans.get('a/b');
    expect(requests[1]?.url.pathname).toBe('/api/v1/console/plans/a%2Fb');
  });

  it('accepte une version sans champ plan ni droit nul ni prix', async () => {
    const bare = f.versionData({ prices: [], entitlements: [] });
    const { plans } = setup(() => json(200, f.planResponse(f.planData({ versions: [bare] }))));
    expect((await plans.get('gold')).versions[0]).toMatchObject({ prices: [], entitlements: [] });
  });

  it('ouvre un brouillon par POST sans corps, la preuve étant ajoutée par la couche fetch', async () => {
    const { plans, writes } = setup(() => json(201, f.versionResponse()));
    const version = await plans.createDraft('gold');

    expect(writes()[0]).toMatchObject({ method: 'POST', body: null });
    expect(writes()[0]?.url.pathname).toBe('/api/v1/console/plans/gold/versions');
    expect(version).toMatchObject({ version: 3, status: 'draft', publicSignup: false });
  });

  it('modifie un brouillon avec les noms de champs du serveur et sans clé non fournie', async () => {
    const { plans, writes } = setup(() => json(200, f.versionResponse()));
    await plans.updateDraft(f.PLAN_IDS.v3, {
      publicSignup: true,
      prices: [{ currency: 'EUR', monthlyAmount: 3900, yearlyAmount: 39000 }],
      entitlements: [{ feature: 'leases', enabled: true, limit: 150 }, { feature: 'rent', enabled: false, limit: null }],
    });
    await plans.updateDraft(f.PLAN_IDS.v3, { publicSignup: false });

    expect(writes()[0]).toMatchObject({ method: 'PATCH' });
    expect(writes()[0]?.url.pathname).toBe(`/api/v1/console/plan-versions/${f.PLAN_IDS.v3}`);
    expect(writes()[0]?.body).toEqual({
      public_signup: true,
      prices: [{ currency: 'EUR', monthly_amount: 3900, yearly_amount: 39000 }],
      entitlements: [{ feature: 'leases', enabled: true, limit_value: 150 }, { feature: 'rent', enabled: false, limit_value: null }],
    });
    expect(writes()[1]?.body).toEqual({ public_signup: false });
  });

  it.each([
    ['liste', (api: ReturnType<typeof setup>) => api.plans.list()],
    ['lecture', (api: ReturnType<typeof setup>) => api.plans.get('gold')],
    ['brouillon', (api: ReturnType<typeof setup>) => api.plans.createDraft('gold')],
    ['modification', (api: ReturnType<typeof setup>) => api.plans.updateDraft(f.PLAN_IDS.v3, { publicSignup: true })],
  ] as const)('refuse une réponse hors contrat (%s)', async (_name, call) => {
    const api = setup(() => json(200, { data: [{ id: 1 }] }));
    await expect(call(api)).rejects.toBeInstanceOf(UnexpectedResponseError);
  });

  it.each([
    [401, problem(401, 'unauthenticated', 'Non authentifié'), 'unauthenticated'],
    [403, problem(403, 'operator_role_required', 'Votre rôle d’opérateur ne permet pas cette opération.'), 'forbidden'],
    [404, problem(404, 'plan_not_found', 'Ce plan ou cette version n’existe pas.'), 'not_found'],
    [409, problem(409, 'plan_draft_exists', 'Ce plan a déjà un brouillon.'), 'conflict'],
    [422, problem(422, 'plan_version_invalid', 'Cette version ne peut pas être publiée en l’état.'), 'invalid'],
  ] as const)('traduit l’erreur %i du serveur', async (status, body, kind) => {
    const { plans } = setup(() => json(status, body));
    const error = await plans.createDraft('gold').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(describeProblem(error).kind).toBe(kind);
    expect(describeProblem(error).code).toBe(body.code);
  });

  it('indique le délai d’une limitation de débit', async () => {
    const { plans } = setup(() => json(429, problem(429, 'throttled', 'Trop de requêtes'), { 'Retry-After': '12' }));
    const error = await plans.list().catch((caught: unknown) => caught);
    expect(describeProblem(error)).toMatchObject({ kind: 'rate_limited', retryAfterSeconds: 12 });
    expect(describeProblem(error).message).toContain('12 s');
  });
});

describe('abonnements', () => {
  it('liste avec filtres et curseur, sans jamais exposer MRR ni ARR', async () => {
    const { subscriptions, requests } = setup(() => json(200, f.subscriptionsResponse([f.subscriptionData()], { has_more: true, next_cursor: 'abc', mrr: '1200', arr: '14400' })));
    const page = await subscriptions.list({ status: 'trialing', plan: ' gold ', trialEnding: true, cursor: 'zzz', perPage: 25 });

    const params = requests[0]?.url.searchParams;
    expect(params?.get('status')).toBe('trialing');
    expect(params?.get('plan')).toBe('gold');
    expect(params?.get('trial_ending')).toBe('1');
    expect(params?.get('cursor')).toBe('zzz');
    expect(params?.get('per_page')).toBe('25');
    expect(page).toEqual({
      rows: [{ id: f.PLAN_IDS.subscription, organizationId: f.PLAN_IDS.org, plan: 'gold', planVersion: 2, status: 'trialing', currency: 'EUR', trialEndsAt: '2026-11-23T10:00:00+00:00', currentPeriodEnd: null, createdAt: '2026-11-08T10:00:00+00:00' }],
      hasMore: true,
      nextCursor: 'abc',
    });
  });

  it('refuse un statut inconnu', async () => {
    const { subscriptions } = setup(() => json(200, f.subscriptionsResponse([f.subscriptionData({ status: 'zombie' })])));
    await expect(subscriptions.list()).rejects.toBeInstanceOf(UnexpectedResponseError);
  });
});

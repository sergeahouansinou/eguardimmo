import { ApiError, createApiClient } from '@eguardimmo/api';
import { describe, expect, it, vi } from 'vitest';
import { requestUrl } from '../../../test/requestUrl';
import { UnexpectedResponseError, describeProblem } from '../errors';
import { IDS, problem, roleRequired } from '../fixtures';
import { subscriptionsApi } from '../plans/subscriptions';
import { entitlementsView, organisationDetail, organisationList, organisationRow, suspendedSuspension, supportAccess } from './fixtures';
import { organisationsApi } from './organisations';
import { supportAccessesApi } from './supportAccesses';

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

function setup(...responses: Response[]) {
  const queue = [...responses];
  const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(queue.shift() ?? json(500, { code: 'unexpected' })));
  const client = createApiClient({ baseUrl: 'https://console.test', fetchImpl, readCookie: () => 'x' });
  const url = (index = 0) => new URL(requestUrl(fetchImpl.mock.calls[index]?.[0] ?? ''));
  return { client, fetchImpl, url };
}

describe('API des organisations de la console', () => {
  it('liste avec filtres et curseur, et traduit chaque ligne', async () => {
    const { client, url } = setup(json(200, organisationList([organisationRow(), organisationRow({ id: IDS.second, state: 'suspended', suspension: suspendedSuspension, plan: null, subscription_status: null })], { has_more: true, next_cursor: 'abc' })));
    const page = await organisationsApi(client).list({ kind: 'agency', state: 'active', search: ' port ', plan: 'silver', subscriptionStatus: 'active', cursor: 'c1', perPage: 25 });

    expect(url().pathname).toBe('/api/v1/console/organizations');
    expect(Object.fromEntries(url().searchParams)).toEqual({ kind: 'agency', state: 'active', search: 'port', plan: 'silver', subscription_status: 'active', cursor: 'c1', per_page: '25' });
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe('abc');
    expect(page.rows[0]).toMatchObject({ id: IDS.org, name: 'Agence du Port', kind: 'agency', state: 'active', membersCount: 3, plan: 'silver', subscriptionStatus: 'active', owner: null, twoFactorRequired: null });
    expect(page.rows[1]).toMatchObject({ state: 'suspended', plan: null, suspension: { reason: 'fraud', suspendedAt: '2026-11-18T09:00:00+00:00' } });
  });

  it('n’envoie pas une recherche de moins de trois caractères', async () => {
    const { client, url } = setup(json(200, organisationList([])));
    await organisationsApi(client).list({ search: 'ag' });

    expect(url().searchParams.has('search')).toBe(false);
  });

  it('lit la fiche avec titulaire et 2FA', async () => {
    const { client, url } = setup(json(200, { data: organisationDetail() }));
    const organisation = await organisationsApi(client).get(IDS.org);

    expect(url().pathname).toBe(`/api/v1/console/organizations/${IDS.org}`);
    expect(organisation.owner).toEqual({ firstName: 'Awa', lastName: 'Diallo', accountId: IDS.user });
    expect(organisation.twoFactorRequired).toBe(false);
  });

  it('refuse un type d’organisation hors contrat', async () => {
    const { client } = setup(json(200, organisationList([organisationRow({ kind: 'tenant' })])));

    await expect(organisationsApi(client).list()).rejects.toBeInstanceOf(UnexpectedResponseError);
  });

  it('refuse une fiche dont la suspension est incohérente', async () => {
    const { client } = setup(json(200, { data: organisationDetail({ state: 'suspended', suspension: { reason: 'fraud' } }) }));

    await expect(organisationsApi(client).get(IDS.org)).rejects.toBeInstanceOf(UnexpectedResponseError);
  });

  it.each([
    [401, { code: 'unauthenticated', title: 'Non authentifié' }, 'unauthenticated'],
    [403, roleRequired, 'forbidden'],
    [404, problem(404, 'organization_not_found', 'Organisation introuvable.'), 'not_found'],
    [429, problem(429, 'too_many_requests', 'Trop de requêtes.'), 'rate_limited'],
  ] as const)('propage une erreur %i sans la masquer', async (status, body, kind) => {
    const { client } = setup(json(status, body, status === 429 ? { 'Retry-After': '12' } : {}));
    const error: unknown = await organisationsApi(client).get(IDS.org).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(describeProblem(error).kind).toBe(kind);
    if (status === 429) expect(describeProblem(error).message).toContain('12 s');
  });
});

describe('accès du support à une organisation', () => {
  it('liste avec filtre de statut et garde le motif nul quand il n’est pas servi', async () => {
    const { client, url } = setup(json(200, { data: [supportAccess(), supportAccess({ id: IDS.version, reason: null, kind: 'emergency', status: 'expired', revoked_at: null })], meta: { has_more: false, next_cursor: null } }));
    const page = await supportAccessesApi(client).list(IDS.org, { status: 'active', perPage: 10 });

    expect(url().pathname).toBe(`/api/v1/console/organizations/${IDS.org}/support-accesses`);
    expect(Object.fromEntries(url().searchParams)).toEqual({ status: 'active', per_page: '10' });
    expect(page.rows[0]).toMatchObject({ kind: 'consent', status: 'active', scopes: ['settings', 'team'], durationHours: 24, readCount: 2, operator: { name: 'Jean Moreau' } });
    expect(page.rows[1]).toMatchObject({ reason: null, kind: 'emergency', status: 'expired' });
  });

  it('refuse un statut inconnu et propage un 404', async () => {
    const bad = setup(json(200, { data: [supportAccess({ status: 'pending' })], meta: { has_more: false, next_cursor: null } }));
    await expect(supportAccessesApi(bad.client).list(IDS.org)).rejects.toBeInstanceOf(UnexpectedResponseError);

    const missing = setup(json(404, problem(404, 'organization_not_found', 'Organisation introuvable.')));
    await expect(supportAccessesApi(missing.client).list(IDS.org)).rejects.toMatchObject({ status: 404, code: 'organization_not_found' });
  });
});

describe('droits effectifs d’une organisation', () => {
  it('traduit l’abonnement, les droits avec leur source et les dérogations', async () => {
    const { client, url } = setup(json(200, entitlementsView()));
    const view = await subscriptionsApi(client).organisationEntitlements(IDS.org);

    expect(url().pathname).toBe(`/api/v1/console/organizations/${IDS.org}/entitlements`);
    expect(view.subscription).toMatchObject({ plan: 'silver', planVersion: 2, status: 'active', currency: 'EUR' });
    expect(view.entitlements.map((e) => [e.feature, e.source, e.limit])).toEqual([['properties', 'plan', 50], ['users', 'override', 10], ['banking', 'plan', null]]);
    expect(view.overrides[0]).toMatchObject({ feature: 'users', limit: 10, reasonCode: 'commercial_gesture', revokedAt: null });
  });

  it('remonte subscription_not_found et un schéma incomplet', async () => {
    const missing = setup(json(404, problem(404, 'subscription_not_found', 'Cette organisation n’a pas d’abonnement.')));
    await expect(subscriptionsApi(missing.client).organisationEntitlements(IDS.org)).rejects.toMatchObject({ status: 404, code: 'subscription_not_found' });

    const broken = setup(json(200, { data: { organization_id: IDS.org } }));
    await expect(subscriptionsApi(broken.client).organisationEntitlements(IDS.org)).rejects.toBeInstanceOf(UnexpectedResponseError);
  });
});

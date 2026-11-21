import { createApiClient } from '@eguardimmo/api';
import { describe, expect, it, vi } from 'vitest';
import { requestUrl } from '../../../test/requestUrl';
import { UnexpectedResponseError, describeProblem } from '../errors';
import { IDS, problem, proofRequired, roleRequired } from '../fixtures';
import { accountFile, accountSummary, suspensionState } from './fixtures';
import { accountsApi } from './accounts';
import { operatorsApi } from './operators';

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

function setup(...responses: Response[]) {
  const queue = [...responses];
  const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(queue.shift() ?? json(500, { code: 'unexpected' })));
  const client = createApiClient({ baseUrl: 'https://console.test', fetchImpl, readCookie: () => 'x' });
  const url = (index = 0) => new URL(requestUrl(fetchImpl.mock.calls[index]?.[0] ?? ''));
  const body = (index = 0): unknown => {
    const raw = fetchImpl.mock.calls[index]?.[1]?.body;
    return typeof raw === 'string' ? JSON.parse(raw) : null;
  };
  return { client, fetchImpl, url, body };
}

describe('API des comptes de la console', () => {
  it('cherche par adresse exacte puis par identifiant, un résultat au plus', async () => {
    const byEmail = setup(json(200, { data: [accountSummary()] }));
    const found = await accountsApi(byEmail.client).search({ email: ' jeanne@exemple.fr ' });
    expect(Object.fromEntries(byEmail.url().searchParams)).toEqual({ email: 'jeanne@exemple.fr' });
    expect(found).toEqual([{ id: IDS.user, name: 'Jeanne Martin', email: 'jeanne@exemple.fr', deleted: false, suspended: false, isOperator: false }]);

    const byId = setup(json(200, { data: [accountSummary({ email: null, deleted: true })] }));
    const gone = await accountsApi(byId.client).search({ id: IDS.user });
    expect(Object.fromEntries(byId.url().searchParams)).toEqual({ id: IDS.user });
    expect(gone[0]).toMatchObject({ email: null, deleted: true });

    const none = setup(json(200, { data: [] }));
    expect(await accountsApi(none.client).search({ email: 'inconnu@exemple.fr' })).toEqual([]);
  });

  it('lit la fiche : suspension, 2FA, comptes et types de profil', async () => {
    const { client, url } = setup(json(200, { data: accountFile({ suspension: suspensionState() }) }));
    const account = await accountsApi(client).get(IDS.user);

    expect(url().pathname).toBe(`/api/v1/console/accounts/${IDS.user}`);
    expect(account).toMatchObject({ name: 'Jeanne Martin', twoFactor: { enabled: true, recoveryCodesRemaining: 2 }, devicesCount: 1, tokensCount: 1, organizationsCount: 2, profileTypes: ['organization', 'tenant'] });
    expect(account.suspension).toEqual({ suspendedAt: '2026-11-20T11:00:00+00:00', reason: 'fraud', reviewed: false, reviewedAt: null });
  });

  it('lit un compte supprimé sans adresse ni date de création', async () => {
    const { client } = setup(json(200, { data: accountFile({ email: null, deleted: true, deleted_at: '2026-11-10T10:00:00+00:00', created_at: null, last_login_at: null, two_factor: { enabled: false, recovery_codes_remaining: null } }) }));
    const account = await accountsApi(client).get(IDS.user);

    expect(account).toMatchObject({ email: null, deleted: true, createdAt: null, lastLoginAt: null, twoFactor: { enabled: false, recoveryCodesRemaining: null } });
  });

  it('envoie la révocation de sessions sans corps puis la suspension avec son motif', async () => {
    const { client, url, body } = setup(json(200, { data: accountFile() }), json(200, { data: accountFile({ suspension: suspensionState() }) }), json(200, { data: accountFile({ suspension: suspensionState({ reviewed: true, reviewed_at: '2026-11-20T12:00:00+00:00' }) }) }));
    const api = accountsApi(client);
    await api.revokeSessions(IDS.user);
    const suspended = await api.suspend(IDS.user, 'abuse');
    const reviewed = await api.reviewSuspension(IDS.user);

    expect(url(0).pathname).toBe(`/api/v1/console/accounts/${IDS.user}/session-revocation`);
    expect(body(0)).toBeNull();
    expect(url(1).pathname).toBe(`/api/v1/console/accounts/${IDS.user}/suspension`);
    expect(body(1)).toEqual({ reason: 'abuse' });
    expect(suspended.suspension?.reviewed).toBe(false);
    expect(url(2).pathname).toBe(`/api/v1/console/accounts/${IDS.user}/suspension/review`);
    expect(reviewed.suspension?.reviewed).toBe(true);
  });

  it.each([
    [403, problem(403, 'operator_account_protected', 'Un compte opérateur ne se modifie pas depuis la console.'), 'forbidden', 'operator_account_protected'],
    [403, problem(403, 'suspension_review_forbidden', 'Vous ne pouvez pas relire votre propre suspension.'), 'forbidden', 'suspension_review_forbidden'],
    [403, roleRequired, 'forbidden', 'operator_role_required'],
    [404, problem(404, 'account_not_found', 'Aucun compte ne correspond à cette recherche.'), 'not_found', 'account_not_found'],
    [409, problem(409, 'account_already_suspended', 'Ce compte est déjà suspendu.'), 'conflict', 'account_already_suspended'],
    [422, proofRequired, 'invalid', 'operator_proof_required'],
    [422, { ...problem(422, 'validation_failed', 'Invalide.'), errors: { reason: ['Le motif est invalide.'] } }, 'invalid', 'validation_failed'],
    [429, problem(429, 'too_many_requests', 'Trop de recherches.'), 'rate_limited', 'too_many_requests'],
  ] as const)('classe l’erreur %i %s', async (status, payload, kind, code) => {
    const { client } = setup(json(status, payload, status === 429 ? { 'Retry-After': '30' } : {}));
    const error: unknown = await accountsApi(client).suspend(IDS.user, 'fraud').catch((caught: unknown) => caught);

    expect(describeProblem(error)).toMatchObject({ kind, code });
  });

  it('refuse une fiche dont le motif de suspension manque ou dont la date est invalide', async () => {
    const noReviewFlag = setup(json(200, { data: accountFile({ suspension: { suspended_at: '2026-11-20T11:00:00+00:00', reason: 'fraud' } }) }));
    await expect(accountsApi(noReviewFlag.client).get(IDS.user)).rejects.toBeInstanceOf(UnexpectedResponseError);

    const badDate = setup(json(200, { data: accountFile({ created_at: 'hier' }) }));
    await expect(accountsApi(badDate.client).get(IDS.user)).rejects.toBeInstanceOf(UnexpectedResponseError);
  });
});

describe('équipe opérateur', () => {
  it('ignore un rôle inconnu et garde l’état de révocation', async () => {
    const { client } = setup(json(200, { data: [{ id: IDS.me, name: 'Awa Diallo', email: 'awa@eguardimmo.test', roles: ['admin', 'inconnu'], two_factor_confirmed: true, last_login_at: null, state: 'revoked', granted_at: '2026-11-01T09:00:00+00:00' }] }));
    const rows = await operatorsApi(client).list();

    expect(rows[0]).toMatchObject({ roles: ['admin'], state: 'revoked', twoFactorConfirmed: true });
  });
});

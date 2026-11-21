import { describe, expect, it } from 'vitest';
import { UnexpectedResponseError, describeProblem } from '../errors';
import { ERROR_CASES, jsonResponse, setupApi } from '../testApi';
import { operatorsResponse } from './operatorFixtures';
import { operatorsApi } from './operators';

describe('équipe opérateur', () => {
  it('lit les opérateurs actifs et révoqués, sans écriture', async () => {
    const { client, url, method } = setupApi(jsonResponse(200, operatorsResponse));
    const rows = await operatorsApi(client).list();

    expect(method()).toBe('GET');
    expect(url().pathname).toBe('/api/v1/console/operators');
    expect(rows).toEqual([
      { id: '01934f6e-ffff-7000-8000-000000000001', name: 'Awa Diallo', email: 'awa.diallo@eguardimmo.test', roles: ['admin', 'compliance'], twoFactorConfirmed: true, lastLoginAt: '2026-11-16T08:30:00+00:00', state: 'active', grantedAt: '2026-11-01T09:00:00+00:00' },
      { id: '01934f6e-ffff-7000-8000-000000000002', name: 'Jean Moreau', email: 'jean.moreau@eguardimmo.test', roles: ['support'], twoFactorConfirmed: false, lastLoginAt: null, state: 'revoked', grantedAt: '2026-11-02T09:00:00+00:00' },
    ]);
  });

  it('accepte un compte supprimé sans nom ni adresse', async () => {
    const [first] = operatorsResponse.data;
    const { client } = setupApi(jsonResponse(200, { data: [{ ...first, name: null, email: null, roles: [] }] }));

    expect((await operatorsApi(client).list())[0]).toMatchObject({ name: null, email: null, roles: [] });
  });

  it('refuse un état hors actif/révoqué', async () => {
    const [first] = operatorsResponse.data;
    const { client } = setupApi(jsonResponse(200, { data: [{ ...first, state: 'suspended' }] }));

    await expect(operatorsApi(client).list()).rejects.toBeInstanceOf(UnexpectedResponseError);
  });

  it.each(ERROR_CASES)('classe l’erreur %i comme %s', async (status, payload, kind, code) => {
    const { client } = setupApi(jsonResponse(status, payload));
    const error: unknown = await operatorsApi(client).list().catch((caught: unknown) => caught);

    expect(describeProblem(error)).toMatchObject({ kind, code });
  });
});

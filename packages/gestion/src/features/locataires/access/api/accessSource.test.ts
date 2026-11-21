import { describe, expect, it } from 'vitest';
import { TenantAccessApiError } from './accessErrors';
import { createApiTenantAccessSource } from './accessSource';
import * as fx from './responses.fixtures';
import { accessUrl, mockAccessApi, partiesUrl } from './testing';
import type { MockRoute } from './testing';
import type { TenantAccessRole } from '../model';

function build(routes: Record<string, MockRoute>, role: TenantAccessRole | null = 'manager', organizationId: string | null = fx.IDS.org) {
  const mock = mockAccessApi(routes);
  return { ...mock, source: createApiTenantAccessSource({ client: mock.client, organizationId, role }) };
}

describe('droits selon le rôle', () => {
  it.each([
    ['owner', true],
    ['admin', true],
    ['manager', true],
    ['accountant', false],
    [null, false],
  ] as const)('%s : gérer les invitations=%s', (role, manage) => {
    expect(build({}, role).source.permissions).toEqual({ manage });
  });
});

describe('lectures', () => {
  it('cherche les personnes actives et ignore les contacts archivés', async () => {
    const { source, callsTo } = build({ [`GET ${partiesUrl()}`]: { body: fx.partyPage } });

    const choices = await source.search('  dani ');

    expect(Object.fromEntries(callsTo('GET', partiesUrl())[0]?.search ?? [])).toEqual({ kind: 'person', q: 'dani', per_page: '20' });
    expect(choices).toEqual([
      { id: fx.IDS.party, name: 'Danielle Martin', email: 'danielle.martin@example.com' },
      { id: fx.IDS.partyNoEmail, name: 'Yann Le Gall', email: null },
    ]);
  });

  it.each([
    ['none', fx.accessNone, { status: 'none', emailHint: null, expiresAt: null, linkedAt: null }],
    ['invited', fx.accessInvited, { status: 'invited', emailHint: 'd***@example.com', expiresAt: '2026-11-30T10:00:00+00:00', linkedAt: null }],
    ['linked', fx.accessLinked, { status: 'linked', emailHint: 'd***@example.com', expiresAt: null, linkedAt: '2026-11-10T09:30:00+00:00' }],
  ] as const)('lit l’état « %s » d’un accès', async (_, body, expected) => {
    const { source } = build({ [`GET ${accessUrl()}`]: { body } });

    expect(await source.access(fx.IDS.party)).toEqual({ partyId: fx.IDS.party, ...expected });
  });

  it('refuse une réponse hors contrat', async () => {
    const { source } = build({ [`GET ${accessUrl()}`]: { body: { data: { party_id: fx.IDS.party, status: 'weird' } } } });

    await expect(source.access(fx.IDS.party)).rejects.toMatchObject({ kind: 'unexpected_response' });
  });

  it('refuse sans organisation, sans appeler le réseau', async () => {
    const { source, calls } = build({}, 'manager', null);

    await expect(source.access(fx.IDS.party)).rejects.toMatchObject({ kind: 'no_organization' });
    expect(calls).toHaveLength(0);
  });
});

describe('écritures', () => {
  it('invite sans corps d’e-mail pour utiliser l’e-mail principal', async () => {
    const { source, callsTo } = build({ [`POST ${accessUrl()}`]: { status: 201, body: fx.accessInvited } });

    const access = await source.invite(fx.IDS.party, null);

    expect(callsTo('POST', accessUrl())[0]?.body).toEqual({});
    expect(access.status).toBe('invited');
  });

  it('invite avec l’adresse saisie', async () => {
    const { source, callsTo } = build({ [`POST ${accessUrl()}`]: { status: 201, body: fx.accessInvited } });

    await source.invite(fx.IDS.party, 'autre@example.com');

    expect(callsTo('POST', accessUrl())[0]?.body).toEqual({ email: 'autre@example.com' });
  });

  it('révoque l’accès (204 sans corps)', async () => {
    const { source, callsTo } = build({ [`DELETE ${accessUrl()}`]: { status: 204 } });

    await expect(source.revoke(fx.IDS.party)).resolves.toBeUndefined();
    expect(callsTo('DELETE', accessUrl())).toHaveLength(1);
  });
});

describe('erreurs traduites', () => {
  const failing = (status: number, body: unknown, headers?: Record<string, string>) => build({ [`POST ${accessUrl()}`]: { status, body, headers } }).source.invite(fx.IDS.party, null);

  it.each([
    [422, fx.problemEmailRequired, 'invalid', 'Ce contact n’a pas d’e-mail principal : indiquez l’adresse à inviter.'],
    [409, fx.problemAlreadyLinked, 'conflict', 'Ce contact est déjà rattaché à un compte : révoquez son accès avant d’en inviter un autre.'],
    [403, fx.problemForbidden, 'forbidden', 'Votre rôle ne permet pas de gérer les invitations des locataires.'],
    [422, fx.problemInvalidEmail, 'invalid', 'L’adresse e-mail est invalide (254 caractères au plus).'],
  ] as const)('HTTP %s → %s', async (status, body, kind, message) => {
    const error = await failing(status, body).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TenantAccessApiError);
    expect(error).toMatchObject({ kind, message });
  });

  it('traduit un accès introuvable à la révocation', async () => {
    const { source } = build({ [`DELETE ${accessUrl()}`]: { status: 404, body: fx.problemNotFound } });

    await expect(source.revoke(fx.IDS.party)).rejects.toMatchObject({ kind: 'not_found', message: 'Ce contact n’a ni invitation ni accès à révoquer.' });
  });

  it('indique le délai d’attente quand la limite de débit est atteinte', async () => {
    const error = await failing(429, { status: 429, code: 'too_many_requests', title: 'x', detail: 'x' }, { 'Retry-After': '12' }).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ kind: 'rate_limited' });
    expect((error as Error).message).toContain('dans 12 secondes');
  });

  it('signale une indisponibilité du service', async () => {
    const error = await failing(503, { status: 503, code: 'service_unavailable', title: 'x', detail: 'x' }).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ kind: 'unavailable' });
  });
});

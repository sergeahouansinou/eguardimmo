import { ApiError, createApiClient } from '@eguardimmo/api';
import { describe, expect, it, vi } from 'vitest';
import { createApiEquipeSource } from './api';
import { SCOPE_UNSUPPORTED_MESSAGE, teamErrorMessage } from './errors';
import { scopeLabel } from './format';
import { DOMAIN_LABELS } from './roleDomains';
import { ROLE_MATRIX_ROWS, rolesResponse } from './roles.fixtures';

const ORG = '01934f6e-0000-7000-8000-00000000000a';
const MEMBRE = '01934f6e-0000-7000-8000-0000000000b1';

const titulaire = {
  id: '01934f6e-0000-7000-8000-0000000000b0',
  first_name: 'Awa',
  last_name: 'Diallo',
  email: 'awa.diallo@example.com',
  role: 'owner',
  status: 'active',
  scope: { type: 'all', property_ids: [] },
  two_factor: 'enabled',
  last_login_at: '2026-11-15T08:30:00+00:00',
  invited_at: null,
  joined_at: '2026-11-01T09:00:00+00:00',
  message: null,
  self: true,
};

const invitee = {
  ...titulaire,
  id: MEMBRE,
  first_name: 'Fatou',
  last_name: 'Ndiaye',
  email: 'fatou.ndiaye@example.com',
  role: 'manager',
  status: 'invited',
  two_factor: 'pending',
  last_login_at: null,
  invited_at: '2026-11-15T09:00:00+00:00',
  joined_at: null,
  message: 'Bienvenue',
  self: false,
};

function reply(status: number, body: unknown): Response {
  return new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function sourceWith(handler: (url: string, init: RequestInit) => Response) {
  const fetchImpl = vi.fn((url: string, init: RequestInit) => Promise.resolve(handler(url, init)));
  const client = createApiClient({ baseUrl: 'https://api.test', fetchImpl: fetchImpl as unknown as typeof fetch, readCookie: () => 'xsrf' });
  return { source: createApiEquipeSource(client, ORG), fetchImpl };
}

describe('source Équipe branchée sur l’API', () => {
  it('traduit l’équipe du serveur dans le format des écrans', async () => {
    const { source } = sourceWith(() => reply(200, { data: [titulaire, invitee], meta: { two_factor_required: true, seat_limit: null } }));

    const team = await source.getTeam();

    expect(team.twoFactorRequired).toBe(true);
    expect(team.seatLimit).toBeNull();
    expect(team.members[0]).toMatchObject({ role: 'titulaire', status: 'actif', twoFactor: 'activee', self: true, lastLogin: '2026-11-15T08:30:00+00:00' });
    expect(team.members[1]).toMatchObject({ role: 'gestionnaire', status: 'invite', twoFactor: 'a-l-acceptation', message: 'Bienvenue', invitedAt: '2026-11-15T09:00:00+00:00' });
  });

  it('envoie l’invitation avec les rôles et noms de champs du serveur', async () => {
    const { source, fetchImpl } = sourceWith(() => reply(201, { data: invitee }));

    const created = await source.invite({ firstName: 'Fatou', lastName: 'Ndiaye', email: 'fatou.ndiaye@example.com', role: 'gestionnaire', scope: { type: 'all' }, message: '' });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.test/api/v1/org/${ORG}/members`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'fatou.ndiaye@example.com', first_name: 'Fatou', last_name: 'Ndiaye', role: 'manager', scope: { type: 'all' }, message: null,
    });
    expect(created.id).toBe(MEMBRE);
  });

  it('remonte le message du serveur quand une règle refuse l’action', async () => {
    const { source } = sourceWith(() => reply(409, { code: 'owner_immutable', title: 'Titulaire non modifiable', detail: 'Le titulaire du compte ne peut être ni retiré, ni désactivé, ni changé de rôle.' }));

    const failure = await source.remove(MEMBRE).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).message).toContain('titulaire');
  });

  it('appelle les bons points d’accès pour désactiver, réactiver et imposer la double authentification', async () => {
    const { source, fetchImpl } = sourceWith((url, init) => (init.method === 'PUT' ? reply(200, { data: {} }) : reply(200, { data: { ...invitee, status: 'disabled' } })));

    await source.deactivate(MEMBRE);
    await source.reactivate(MEMBRE);
    await source.setTwoFactorRequired(true);

    const calls = fetchImpl.mock.calls.map(([url, init]) => `${String(init.method)} ${url.replace(`https://api.test/api/v1/org/${ORG}`, '')}`);
    expect(calls).toEqual([`POST /members/${MEMBRE}/deactivation`, `DELETE /members/${MEMBRE}/deactivation`, 'PUT /security']);
  });

  it('ne propose plus de périmètre par bien : une valeur « selected » est refusée sans appeler le serveur', async () => {
    const { source, fetchImpl } = sourceWith(() => reply(200, { data: invitee }));

    await expect(source.changeScope(MEMBRE, { type: 'selected', buildings: ['Les Tilleuls'] } as never)).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rétablit « Tous les biens » par PATCH', async () => {
    const { source, fetchImpl } = sourceWith(() => reply(200, { data: invitee }));

    await source.changeScope(MEMBRE, { type: 'all' });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.test/api/v1/org/${ORG}/members/${MEMBRE}`);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ scope: { type: 'all' } });
  });

  it('signale un membre déjà limité à certains biens comme « périmètre non appliqué »', async () => {
    const limited = { ...invitee, scope: { type: 'selected', property_ids: ['01934f6e-0000-7000-8000-0000000000a1'] } };
    const { source } = sourceWith(() => reply(200, { data: [limited], meta: { two_factor_required: false, seat_limit: null } }));

    const team = await source.getTeam();

    expect(team.members.map((member) => member.scope)).toEqual([{ type: 'selected', buildings: [] }]);
    expect(team.members.map(scopeLabel)).toEqual(['Périmètre non appliqué']);
  });

  it('traduit le refus 422 member_scope_unsupported du serveur en message clair', async () => {
    const { source } = sourceWith(() => reply(422, { code: 'member_scope_unsupported', title: 'Périmètre non appliqué', detail: 'Texte serveur', status: 422 }));

    const failure = await source.invite({ firstName: 'Fatou', lastName: 'Ndiaye', email: 'fatou.ndiaye@example.com', role: 'gestionnaire', scope: { type: 'all' }, message: '' }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).code).toBe('member_scope_unsupported');
    expect(teamErrorMessage(failure, 'défaut')).toBe(SCOPE_UNSUPPORTED_MESSAGE);
    expect(teamErrorMessage(new Error('autre'), 'défaut')).toBe('autre');
  });
});

describe('limite de plan à l’invitation', () => {
  it('conserve code et extensions du 409 plan_quota_reached et le formule en français', async () => {
    const { source } = sourceWith(() => reply(409, { code: 'plan_quota_reached', title: 'Quota atteint', detail: 'Texte serveur', status: 409, feature: 'users', limit: 3, current: 3 }));

    const failure = await source.invite({ firstName: 'Fatou', lastName: 'Ndiaye', email: 'fatou.ndiaye@example.com', role: 'gestionnaire', scope: { type: 'all' }, message: '' }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).extensions).toEqual({ feature: 'users', limit: 3, current: 3 });
    expect(teamErrorMessage(failure, 'défaut')).toBe('Limite de votre plan atteinte : 3 membres sur 3. Passez à une formule supérieure pour continuer.');
  });
});

describe('matrice des droits servie par GET /roles', () => {
  it('lit la matrice complète du serveur dans le format des écrans', async () => {
    const { source, fetchImpl } = sourceWith(() => reply(200, rolesResponse('manager')));

    const matrix = await source.getRoles();

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.test/api/v1/org/${ORG}/roles`);
    expect(init.method ?? 'GET').toBe('GET');
    expect(matrix.currentRole).toBe('gestionnaire');
    expect(matrix.domains).toHaveLength(ROLE_MATRIX_ROWS.length);
    const sensitive = matrix.domains.find((domain) => domain.key === 'owner_funds_sensitive');
    expect(sensitive).toMatchObject({
      levels: { titulaire: 'write_two_factor', administrateur: 'write_two_factor', gestionnaire: 'none', comptable: 'write_two_factor' },
      twoFactor: true,
      highlighted: true,
    });
    expect(matrix.domains.find((domain) => domain.key === 'owner_funds')?.levels.gestionnaire).toBe('prepare');
    expect(matrix.domains.find((domain) => domain.key === 'team')).toMatchObject({ twoFactor: false, levels: { comptable: 'read', gestionnaire: 'read', titulaire: 'write' } });
    expect(matrix.domains.find((domain) => domain.key === 'mandates')?.note).toMatch(/note de mandat/);
  });

  it('donne un libellé français à chaque domaine du serveur', async () => {
    const { source } = sourceWith(() => reply(200, rolesResponse()));

    const matrix = await source.getRoles();

    for (const domain of matrix.domains) {
      expect(DOMAIN_LABELS[domain.key], domain.key).toBeDefined();
      expect(domain.label.startsWith('Droits «'), domain.key).toBe(false);
    }
    expect(Object.keys(DOMAIN_LABELS).sort()).toEqual(ROLE_MATRIX_ROWS.map(([key]) => key).sort());
  });

  it('affiche un domaine inconnu sous sa clé plutôt que de le masquer', async () => {
    const response = rolesResponse();
    response.data.domains.push({ key: 'nouveau_domaine', levels: { owner: 'read', admin: 'read', manager: 'none', accountant: 'none' }, two_factor: false });
    const { source } = sourceWith(() => reply(200, response));

    const matrix = await source.getRoles();

    expect(matrix.domains.at(-1)).toMatchObject({ key: 'nouveau_domaine', label: 'Droits « nouveau_domaine »', highlighted: false });
  });

  it('refuse une réponse dont un niveau est inconnu', async () => {
    const response = rolesResponse();
    const [first] = response.data.domains;
    if (first) first.levels.owner = 'superadmin';
    const { source } = sourceWith(() => reply(200, response));

    await expect(source.getRoles()).rejects.toThrow();
  });

  it('remonte une panne serveur sans la transformer en matrice vide', async () => {
    const { source } = sourceWith(() => reply(500, { code: 'server_error', title: 'Erreur', status: 500 }));

    await expect(source.getRoles()).rejects.toBeInstanceOf(ApiError);
  });
});

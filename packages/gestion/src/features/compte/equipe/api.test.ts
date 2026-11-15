import { ApiError, createApiClient } from '@eguardimmo/api';
import { describe, expect, it, vi } from 'vitest';
import { createApiEquipeSource } from './api';

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

  it('refuse un périmètre par bien tant que le module Biens n’existe pas, sans appeler le serveur', async () => {
    const { source, fetchImpl } = sourceWith(() => reply(200, { data: invitee }));

    await expect(source.changeScope(MEMBRE, { type: 'selected', buildings: ['Les Tilleuls'] })).rejects.toThrow('Tous les biens');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
